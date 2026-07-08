/**
 * 聊天状态管理 composable。
 *
 * 管理消息列表、Agent 状态、发送消息等。
 * Agent Loop 在浏览器端运行，通过 AgentEventSink 回调驱动 UI 更新。
 */

import { ref, reactive, nextTick } from 'vue'
import { createAgentState, type CreateAgentStateOptions } from '@/agent/state'
import { runAgentLoop } from '@/agent/loop'
import { pushMessage } from '@/session/memory'
import { setDefaultProvider, getDefaultModel } from '@/llm/index'
import type { AgentState, AgentLifecycleState } from '@/agent/types'
import type { LlmMessage } from '@/llm/types'
import type { ToolContext } from '@/tools/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCallInfo[]
}

export interface ToolCallInfo {
  name: string
  input: unknown
  ok?: boolean
  preview?: string
}

export function useChat() {
  const messages = reactive<ChatMessage[]>([])
  const isGenerating = ref(false)
  const agentState = ref<AgentLifecycleState>('idle')
  const error = ref<string | null>(null)

  let state: AgentState | null = null

  function init(opts?: {
    provider?: 'openai' | 'anthropic'
    model?: string
    githubUsername?: string
  }) {
    if (opts?.provider) {
      setDefaultProvider(opts.provider, opts.model)
    }

    const ctx: ToolContext = {
      dataPath: '/portfolio-data',
      githubUsername: opts?.githubUsername,
    }

    state = createAgentState({
      ctx,
      sink: {
        onAssistantText(text) {
          const lastMsg = messages[messages.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content += text
          }
        },
        onToolCall(name, input) {
          const lastMsg = messages[messages.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            if (!lastMsg.toolCalls) lastMsg.toolCalls = []
            lastMsg.toolCalls.push({ name, input })
          }
        },
        onToolResult(name, ok, preview) {
          const lastMsg = messages[messages.length - 1]
          if (lastMsg?.toolCalls) {
            const tc = lastMsg.toolCalls.find((t) => t.name === name && t.ok === undefined)
            if (tc) {
              tc.ok = ok
              tc.preview = preview
            }
          }
        },
        onStateChange(s) {
          agentState.value = s
        },
      },
    })
  }

  function addMessage(role: ChatMessage['role'], content: string): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
    }
    messages.push(msg)
    return msg
  }

  async function sendMessage(content: string) {
    if (!state) {
      error.value = '请先初始化聊天'
      return
    }
    if (isGenerating.value) return
    if (!content.trim()) return

    error.value = null

    // 用户消息
    addMessage('user', content)
    pushMessage(state.memory, { role: 'user', content })

    // assistant 消息占位
    const assistantMsg = addMessage('assistant', '')

    isGenerating.value = true
    state.turn = 0

    try {
      const { stopped, finalText } = await runAgentLoop(state)

      // 更新最终文本（如果 agent 没有通过 onAssistantText 回调更新）
      if (assistantMsg.content === '' && finalText) {
        assistantMsg.content = finalText
      }

      if (stopped === 'maxTokens') {
        assistantMsg.content += '\n\n[输出被截断]'
      } else if (stopped === 'refusal') {
        assistantMsg.content = '[模型拒答]'
      } else if (stopped === 'maxTurns') {
        assistantMsg.content += '\n\n[达到最大轮次限制]'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
      assistantMsg.content = `抱歉，发生了错误：${error.value}`
    } finally {
      isGenerating.value = false
      agentState.value = 'idle'
    }
  }

  function clearMessages() {
    messages.splice(0, messages.length)
    if (state) {
      // 保留 system prompt
      const systemMsgs = state.memory.recentMessages.filter((m) => m.role === 'system')
      state.memory.recentMessages = systemMsgs
    }
  }

  return {
    messages,
    isGenerating,
    agentState,
    error,
    init,
    sendMessage,
    clearMessages,
  }
}
