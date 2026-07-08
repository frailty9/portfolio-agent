/**
 * Agent Loop：让 LLM 在多轮迭代中调用工具，最终产出回答。
 *
 * 流程：
 *   1. 调 LLM → 收集 tool_calls
 *   2. 执行工具 → 结果喂回
 *   3. 终止：无 tool_call / maxTurns / max_tokens / refusal
 *
 * 移植自 docforge/src/agent.ts，简化为前端版本。
 */

import { chat } from '@/llm/index'
import { findTool } from '@/tools/index'
import { pushMessage } from '@/session/memory'
import { refreshSystemMessage } from '@/prompt/index'
import type { LlmMessage, LlmResponse } from '@/llm/types'
import type { AgentState, AgentStopReason, AgentTurnResult } from './types'

const MAX_TOOLS_PER_TURN = 4
const TOOL_RESULT_MAX_BYTES = 100 * 1024 // 100 KiB

/**
 * 完整 agent 循环。
 * 调用方需在 state.memory 中已 push user 消息。
 */
export async function runAgentLoop(
  state: AgentState,
): Promise<{ stopped: AgentStopReason; finalText: string }> {
  // 刷新 system 消息，注入最新的 taskSummary / constraints / findings
  refreshSystemMessage(state.memory)

  let stopped: AgentStopReason = 'done'
  let finalText = ''

  while (state.turn < state.maxTurns) {
    const turn = await runAgentTurn(state)
    finalText = turn.chatResult.content

    if (turn.stopped) {
      stopped = turn.stopped
      break
    }
  }

  if (stopped === 'done' && state.turn >= state.maxTurns) {
    stopped = 'maxTurns'
  }

  return { stopped, finalText }
}

/**
 * 单 turn：调一次 LLM、执行所有 tool_call。
 */
export async function runAgentTurn(state: AgentState): Promise<AgentTurnResult> {
  state.sink.onStateChange?.('thinking')

  // 1. 调 LLM
  const chatResult = await chat(state.memory.recentMessages, {
    tools: state.tools,
    temperature: 0.6,
  })

  state.totalInputTokens += chatResult.usage.inputTokens
  state.totalOutputTokens += chatResult.usage.outputTokens
  if (chatResult.content) state.sink.onAssistantText?.(chatResult.content)

  // 2. 构造 assistant 消息
  const assistantMessage: LlmMessage = {
    role: 'assistant',
    content: chatResult.content,
    ...(chatResult.toolCalls.length > 0 ? { toolCalls: chatResult.toolCalls } : {}),
  }
  pushMessage(state.memory, assistantMessage)

  let stopped: AgentStopReason | undefined

  // 3. 终止条件
  if (chatResult.stopReason === 'max_tokens' || chatResult.stopReason === 'length') {
    stopped = 'maxTokens'
  } else if (chatResult.stopReason === 'refusal') {
    stopped = 'refusal'
  } else if (chatResult.toolCalls.length === 0) {
    stopped = 'done'
  }

  if (!stopped && chatResult.toolCalls.length > 0) {
    state.sink.onStateChange?.('tool-running')

    // 4. 执行 tool_calls
    const seenIds = new Set<string>()
    let toolsThisTurn = 0

    for (const call of chatResult.toolCalls) {
      if (seenIds.has(call.id)) continue
      seenIds.add(call.id)

      if (toolsThisTurn >= MAX_TOOLS_PER_TURN) {
        pushMessage(state.memory, {
          role: 'tool',
          toolCallId: call.id,
          content: `[已跳过] 本轮工具调用数超过上限（${MAX_TOOLS_PER_TURN}）`,
        })
        continue
      }

      state.sink.onToolCall?.(call.name, call.input)

      const tool = findTool(call.name)
      if (!tool) {
        const msg = `未知工具: ${call.name}`
        state.sink.onToolResult?.(call.name, false, msg)
        pushMessage(state.memory, {
          role: 'tool',
          toolCallId: call.id,
          content: msg,
          isError: true,
        })
        toolsThisTurn++
        continue
      }

      try {
        const result = await tool.execute(state.ctx, call.input)
        const serialized = safeStringify(result)
        const truncated = serialized.length > TOOL_RESULT_MAX_BYTES
        const finalContent = truncated
          ? serialized.slice(0, TOOL_RESULT_MAX_BYTES) + '\n[...truncated]'
          : serialized

        state.sink.onToolResult?.(tool.name, true, finalContent.slice(0, 200))
        pushMessage(state.memory, {
          role: 'tool',
          toolCallId: call.id,
          content: finalContent,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        state.sink.onToolResult?.(tool.name, false, msg.slice(0, 200))
        pushMessage(state.memory, {
          role: 'tool',
          toolCallId: call.id,
          content: msg,
          isError: true,
        })
      }

      toolsThisTurn++
    }
  }

  state.sink.onStateChange?.('done')
  state.turn++

  return {
    chatResult,
    ...(stopped ? { stopped } : {}),
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) => {
      if (typeof val === 'bigint') return val.toString()
      if (typeof val === 'function') return '[function]'
      return val
    })
  } catch {
    return String(v)
  }
}
