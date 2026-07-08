/**
 * 聊天状态管理 composable。
 *
 * 管理消息列表、Agent 状态、发送消息等。
 * Agent Loop 在浏览器端运行，通过 AgentEventSink 回调驱动 UI 更新。
 * 配置从 /config.json 运行时加载。
 * 会话自动持久化到 localStorage，支持多会话管理。
 */

import { ref, reactive } from 'vue';
import { createAgentState } from '@/agent/state';
import { runAgentLoop } from '@/agent/loop';
import { maybeSummarize } from '@/agent/summarize';
import { pushMessage } from '@/session/memory';
import {
    saveSession,
    loadLatestSession,
    loadSession,
    listSessions,
    deleteSession,
    deleteAllSessions,
    type SessionIndexItem,
} from '@/session/store';
import { setDefaultProvider } from '@/llm/index';
import { loadConfig } from '@/utils/env';
import type { AgentState, AgentLifecycleState } from '@/agent/types';
import type { ToolContext } from '@/tools/types';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    toolCalls?: ToolCallInfo[];
}

export interface ToolCallInfo {
    name: string;
    input: unknown;
    ok?: boolean;
    preview?: string;
}

export function useChat() {
    const messages = reactive<ChatMessage[]>([]);
    const isGenerating = ref(false);
    const agentState = ref<AgentLifecycleState>('idle');
    const error = ref<string | null>(null);
    const configLoaded = ref(false);

    let state: AgentState | null = null;
    let sessionId: string | null = null;

    // ========================================================================
    // 初始化 + 会话恢复
    // ========================================================================

    async function init() {
        const config = await loadConfig();
        setDefaultProvider(config.provider, config.model, config.summaryModel);

        const ctx: ToolContext = {
            dataPath: '/portfolio-data',
            githubUsername: config.githubUsername || undefined,
        };

        state = createAgentState({
            ctx,
            sink: {
                onAssistantText(text) {
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                        lastMsg.content += text;
                    }
                },
                onToolCall(name, input) {
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                        if (!lastMsg.toolCalls) lastMsg.toolCalls = [];
                        lastMsg.toolCalls.push({ name, input });
                    }
                },
                onToolResult(name, ok, preview) {
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg?.toolCalls) {
                        const tc = lastMsg.toolCalls.find(
                            (t) => t.name === name && t.ok === undefined,
                        );
                        if (tc) {
                            tc.ok = ok;
                            tc.preview = preview;
                        }
                    }
                },
                onStateChange(s) {
                    agentState.value = s;
                },
            },
        });

        // 尝试恢复最新会话
        const saved = loadLatestSession();
        if (saved) {
            state.memory = saved.memory;
            sessionId = saved.sessionId;
            // 从 memory 重建前端消息列表
            rebuildMessages(saved.memory);
            // 同步交互计数（用于摘要触发判断）
            state.userInteractionCount = saved.memory.recentMessages.filter(
                (m) => m.role === 'user',
            ).length;
        }

        configLoaded.value = true;
    }

    // ========================================================================
    // 消息管理
    // ========================================================================

    function addMessage(role: ChatMessage['role'], content: string): ChatMessage {
        const msg: ChatMessage = {
            id: crypto.randomUUID(),
            role,
            content,
            timestamp: Date.now(),
        };
        messages.push(msg);
        return msg;
    }

    /**
     * 从 SessionMemory 重建前端消息列表（恢复会话时用）。
     * 只取 user 和 assistant 消息（system / tool 是内部的）。
     */
    function rebuildMessages(memory: import('@/session/types').SessionMemory) {
        messages.splice(0, messages.length);
        for (const msg of memory.recentMessages) {
            if (msg.role === 'user') {
                addMessage('user', msg.content);
            } else if (msg.role === 'assistant' && msg.content) {
                const chatMsg = addMessage('assistant', msg.content);
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    chatMsg.toolCalls = msg.toolCalls.map((tc) => ({
                        name: tc.name,
                        input: tc.input,
                    }));
                }
            }
        }
    }

    async function sendMessage(content: string) {
        if (!state) {
            error.value = '请先初始化聊天';
            return;
        }
        if (isGenerating.value) return;
        if (!content.trim()) return;

        error.value = null;

        // 用户消息
        addMessage('user', content);
        pushMessage(state.memory, { role: 'user', content });

        // assistant 消息占位
        const assistantMsg = addMessage('assistant', '');

        isGenerating.value = true;
        state.turn = 0;
        state.userInteractionCount++;

        try {
            const { stopped, finalText } = await runAgentLoop(state);

            if (assistantMsg.content === '' && finalText) {
                assistantMsg.content = finalText;
            }

            if (stopped === 'maxTokens') {
                assistantMsg.content += '\n\n[输出被截断]';
            } else if (stopped === 'refusal') {
                assistantMsg.content = '[模型拒答]';
            } else if (stopped === 'maxTurns') {
                assistantMsg.content += '\n\n[达到最大轮次限制]';
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : '未知错误';
            assistantMsg.content = `抱歉，发生了错误：${error.value}`;
        } finally {
            isGenerating.value = false;
            agentState.value = 'idle';

            // 自动保存会话
            persistSession();

            // 检查是否需要上下文压缩
            await maybeSummarize(state);
        }
    }

    // ========================================================================
    // 会话持久化
    // ========================================================================

    function persistSession() {
        if (!state) return;
        sessionId = saveSession(state.memory, sessionId ?? undefined);
    }

    function clearMessages() {
        messages.splice(0, messages.length);
        if (state) {
            const systemMsgs = state.memory.recentMessages.filter((m) => m.role === 'system');
            state.memory.recentMessages = systemMsgs;
        }
        // 清空后保存（会覆盖当前会话为只有 system 的状态）
        persistSession();
    }

    /**
     * 开启新会话（不删除旧会话）。
     */
    function newSession() {
        if (!state) return;
        // 断开与当前 sessionId 的关联，下次 save 会生成新 ID
        sessionId = null;
        messages.splice(0, messages.length);
        const systemMsgs = state.memory.recentMessages.filter((m) => m.role === 'system');
        state.memory.recentMessages = systemMsgs;
        state.memory.taskSummary = '';
        state.memory.projectContext.constraints = [];
        state.memory.projectContext.findings = [];
        state.userInteractionCount = 0;
        state.lastSummaryAt = 0;
    }

    /**
     * 加载指定会话。
     */
    function loadSessionById(id: string): boolean {
        const saved = loadSession(id);
        if (!saved || !state) return false;

        state.memory = saved.memory;
        sessionId = saved.sessionId;
        rebuildMessages(saved.memory);
        state.userInteractionCount = saved.memory.recentMessages.filter(
            (m) => m.role === 'user',
        ).length;
        return true;
    }

    /**
     * 获取会话列表。
     */
    function getSessionList(): SessionIndexItem[] {
        return listSessions();
    }

    /**
     * 删除指定会话。
     */
    function deleteSessionById(id: string) {
        deleteSession(id);
        if (sessionId === id) {
            newSession();
        }
    }

    /**
     * 删除所有会话。
     */
    function deleteAllSessionData() {
        deleteAllSessions();
        newSession();
    }

    return {
        messages,
        isGenerating,
        agentState,
        error,
        configLoaded,
        init,
        sendMessage,
        clearMessages,
        newSession,
        loadSessionById,
        getSessionList,
        deleteSessionById,
        deleteAllSessionData,
    };
}
