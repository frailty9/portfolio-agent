/**
 * Agent 相关类型。
 */

import type { LlmResponse, LlmToolSpec } from '@/llm/types';
import type { SessionMemory } from '@/session/types';
import type { ToolContext } from '@/tools/types';

export type AgentStopReason = 'done' | 'maxTurns' | 'maxTokens' | 'refusal';

export interface AgentResult {
    finalText: string;
    turns: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    stopped: AgentStopReason;
}

/** 实时事件回调 */
export interface AgentEventSink {
    onAssistantText?(text: string): void;
    onToolCall?(name: string, input: unknown): void;
    onToolResult?(name: string, ok: boolean, preview: string): void;
    onStateChange?(state: AgentLifecycleState): void;
}

export type AgentLifecycleState = 'thinking' | 'tool-running' | 'done' | 'idle';

export interface AgentState {
    memory: SessionMemory;
    ctx: ToolContext;
    sink: AgentEventSink;
    tools: LlmToolSpec[];
    toolCallCache: Map<string, string>;
    totalInputTokens: number;
    totalOutputTokens: number;
    turn: number;
    maxTurns: number;
    maxRecent: number;
    /** 用户交互次数（每次 sendMessage +1） */
    userInteractionCount: number;
    /** 上次摘要时的 userInteractionCount（避免重复触发） */
    lastSummaryAt: number;
}

export interface AgentTurnResult {
    chatResult: LlmResponse;
    stopped?: AgentStopReason;
}
