/**
 * AgentState 构造。
 */

import { createMemory, pushMessages } from '@/session/memory'
import { getToolSpecs } from '@/tools/index'
import { buildSystemPrompt } from '@/prompt/index'
import type { AgentState, AgentEventSink } from './types'
import type { ToolContext } from '@/tools/types'

export interface CreateAgentStateOptions {
  ctx: ToolContext
  sink?: AgentEventSink
  maxTurns?: number
  maxRecent?: number
}

const DEFAULT_MAX_TURNS = 20
const DEFAULT_MAX_RECENT = 40

export function createAgentState(opts: CreateAgentStateOptions): AgentState {
  const memory = createMemory(opts.maxRecent ?? DEFAULT_MAX_RECENT)
  const tools = getToolSpecs()

  // 注入 system prompt
  const systemPrompt = buildSystemPrompt()
  pushMessages(memory, [{ role: 'system', content: systemPrompt }])

  return {
    memory,
    ctx: opts.ctx,
    sink: opts.sink ?? {},
    tools,
    toolCallCache: new Map(),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    turn: 0,
    maxTurns: opts.maxTurns ?? DEFAULT_MAX_TURNS,
    maxRecent: opts.maxRecent ?? DEFAULT_MAX_RECENT,
    userInteractionCount: 0,
    lastSummaryAt: 0,
  }
}
