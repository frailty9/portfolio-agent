/**
 * 上下文压缩：maybeSummarize。
 *
 * 移植自 docforge/src/agent.ts 的 maybeSummarize。
 *
 * 触发条件（满足任一）：
 * - 每 SUMMARY_INTERVAL 次用户交互
 * - 消息数达 maxRecent * SUMMARY_THRESHOLD
 *
 * 流程：
 * 1. buildSummaryPrompt 构造摘要请求
 * 2. summarize() 调 LLM（优先 summaryModel）
 * 3. parseSummaryResponse 解析六段结构
 * 4. 写入 memory.taskSummary / constraints / findings
 *
 * 错误静默——摘要失败不影响主流程。
 */

import { buildSummaryPrompt, parseSummaryResponse } from '@/prompt/summary';
import { addConstraint, addFinding } from '@/session/memory';
import { updateSessionTitle, listSessions } from '@/session/store';
import { summarize } from '@/llm/index';
import type { AgentState } from './types';

const SUMMARY_INTERVAL = 5;
const SUMMARY_THRESHOLD = 0.8;

/**
 * 检查是否需要触发摘要，如果需要则调 LLM 生成并写入 memory。
 * 每次用户交互后调用。
 */
export async function maybeSummarize(state: AgentState, sessionId?: string | null): Promise<void> {
    const mem = state.memory;
    const count = state.userInteractionCount;
    if (count === 0) return;

    const intervalHit = count > 0 && count % SUMMARY_INTERVAL === 0 && count !== state.lastSummaryAt;
    const thresholdHit = mem.recentMessages.length >= mem.maxRecent * SUMMARY_THRESHOLD;
    if (!intervalHit && !thresholdHit) return;

    try {
        const currentTitle = sessionId
            ? listSessions().find((s) => s.sessionId === sessionId)?.title
            : undefined;
        const summaryMessages = buildSummaryPrompt(mem.recentMessages, currentTitle);
        const result = await summarize(summaryMessages);
        if (result.content) {
            const parsed = parseSummaryResponse(result.content);
            mem.taskSummary = parsed.summary;
            for (const c of parsed.constraints) addConstraint(mem, c);
            for (const f of parsed.findings) addFinding(mem, f);
            if (parsed.newTitle && sessionId) {
                updateSessionTitle(sessionId, parsed.newTitle);
            }
            state.lastSummaryAt = count;
        }
    } catch {
        // 静默：摘要失败不影响主流程
    }
}
