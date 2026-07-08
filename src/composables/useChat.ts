/**
 * 聊天状态管理 composable。
 *
 * 管理消息列表、Agent 状态、发送消息等。
 * Agent Loop 在浏览器端运行，通过 AgentEventSink 回调驱动 UI 更新。
 * 配置从 /config.json 运行时加载。
 * 会话自动持久化到 localStorage，支持多会话管理。
 * Portfolio API 在首次发消息前隐式解析并注入上下文。
 */

import { ref, reactive } from 'vue';
import { createAgentState } from '@/agent/state';
import { runAgentLoop } from '@/agent/loop';
import { maybeSummarize } from '@/agent/summarize';
import { pushMessage, setPortfolioApis } from '@/session/memory';
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
import { loadConfig, type AppConfig } from '@/utils/env';
import { resolvePortfolioApi } from '@/api/portfolioApi';
import type { AgentState, AgentLifecycleState } from '@/agent/types';
import type { ToolContext } from '@/tools/types';
import type { DisplayMessage } from '@/session/types';

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
    const sessionId = ref<string | null>(null);
    let appConfig: AppConfig | null = null;
    let portfolioApiResolved = false;

    const sessions = ref<SessionIndexItem[]>([]);

    function refreshSessions() {
        sessions.value = listSessions();
    }

    /** 将展示层消息转为持久化格式（仅 user + assistant）。 */
    function toDisplayMessages(): DisplayMessage[] {
        return messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: m.timestamp,
                toolCalls: m.toolCalls,
            }));
    }

    // ========================================================================
    // 初始化 + 会话恢复
    // ========================================================================

    async function init() {
        appConfig = await loadConfig();
        setDefaultProvider(appConfig.provider, appConfig.model, appConfig.summaryModel);

        const ctx: ToolContext = {
            githubUsername: appConfig.githubUsername || undefined,
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
            sessionId.value = saved.sessionId;
            rebuildMessages(saved.memory, saved.displayMessages);
            state.userInteractionCount = saved.memory.recentMessages.filter(
                (m) => m.role === 'user',
            ).length;
            // 如果恢复的会话已有 portfolioApis，标记已解析
            if (saved.memory.projectContext.portfolioApis.length > 0) {
                portfolioApiResolved = true;
            }
        }

        refreshSessions();
        configLoaded.value = true;
    }

    // ========================================================================
    // Portfolio API 解析（隐式等待）
    // ========================================================================

    /**
     * 确保 Portfolio API 已解析。
     * 在用户第一条消息发给 LLM 之前调用。
     * 如果已解析或无配置，直接返回。
     * 否则阻塞直到解析完成。
     */
    async function ensurePortfolioApiResolved(): Promise<void> {
        if (portfolioApiResolved) return;
        if (!appConfig?.portfolioApi) {
            portfolioApiResolved = true;
            return;
        }
        if (!state) return;

        try {
            const endpoints = await resolvePortfolioApi(appConfig.portfolioApi);
            setPortfolioApis(state.memory, endpoints, appConfig.portfolioApi.baseUrl);
            portfolioApiResolved = true;
        } catch (err) {
            // 解析失败不阻塞主流程，但标记为已尝试
            portfolioApiResolved = true;
            console.error('Portfolio API 解析失败:', err);
        }
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
     * 从持久化数据重建前端消息列表（恢复会话时用）。
     * 优先使用 displayMessages（完整展示历史）；
     * 回退到 memory.recentMessages（兼容旧数据）。
     */
    function rebuildMessages(
        memory: import('@/session/types').SessionMemory,
        displayMessages?: import('@/session/types').DisplayMessage[],
    ) {
        messages.splice(0, messages.length);
        const source = displayMessages ?? memory.recentMessages.filter(
            (m) => m.role === 'user' || m.role === 'assistant',
        );
        for (const msg of source) {
            if (msg.role === 'user') {
                addMessage('user', msg.content);
            } else if (msg.role === 'assistant' && msg.content) {
                const chatMsg = addMessage('assistant', msg.content);
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    chatMsg.toolCalls = msg.toolCalls.map((tc) => ({
                        name: tc.name,
                        input: tc.input,
                        ...(tc.ok !== undefined && { ok: tc.ok }),
                        ...(tc.preview !== undefined && { preview: tc.preview }),
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
            // 隐式等待：在 LLM 调用前确保 Portfolio API 已解析
            await ensurePortfolioApiResolved();

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

            // 先压缩上下文，再持久化（确保摘要结果被保存）
            await maybeSummarize(state, sessionId.value);
            persistSession();
        }
    }

    // ========================================================================
    // 会话持久化
    // ========================================================================

    function persistSession() {
        if (!state) return;
        sessionId.value = saveSession(
            state.memory,
            sessionId.value ?? undefined,
            toDisplayMessages(),
        );
        refreshSessions();
    }

    function clearMessages() {
        messages.splice(0, messages.length);
        if (state) {
            const systemMsgs = state.memory.recentMessages.filter((m) => m.role === 'system');
            state.memory.recentMessages = systemMsgs;
        }
        persistSession();
    }

    /**
     * 开启新会话（不删除旧会话）。
     */
    function newSession() {
        if (!state) return;
        sessionId.value = null;
        messages.splice(0, messages.length);
        const systemMsgs = state.memory.recentMessages.filter((m) => m.role === 'system');
        state.memory.recentMessages = systemMsgs;
        state.memory.taskSummary = '';
        state.memory.projectContext.constraints = [];
        state.memory.projectContext.findings = [];
        state.memory.projectContext.portfolioApis = [];
        state.userInteractionCount = 0;
        state.lastSummaryAt = 0;
        portfolioApiResolved = false;
        refreshSessions();
    }

    /**
     * 加载指定会话。
     */
    function loadSessionById(id: string): boolean {
        const saved = loadSession(id);
        if (!saved || !state) return false;

        state.memory = saved.memory;
        sessionId.value = saved.sessionId;
        rebuildMessages(saved.memory, saved.displayMessages);
        state.userInteractionCount = saved.memory.recentMessages.filter(
            (m) => m.role === 'user',
        ).length;
        portfolioApiResolved = saved.memory.projectContext.portfolioApis.length > 0;
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
        if (sessionId.value === id) {
            newSession();
        } else {
            refreshSessions();
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
        sessions,
        currentSessionId: sessionId,
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
