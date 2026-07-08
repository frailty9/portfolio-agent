/**
 * OpenAI 兼容适配器。
 *
 * 通过 /api/llm/openai 代理转发，前端不持有 API key。
 * 支持 OpenAI API 格式的各种第三方服务。
 */

import type { LlmAdapter, LlmRequest, LlmResponse, LlmUsage } from '../types'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }>
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    prompt_tokens_details?: { cached_tokens?: number }
  }
}

export class OpenAIAdapter implements LlmAdapter {
  readonly provider = 'openai'
  private baseUrl: string

  constructor(baseUrl = '/api/llm/openai') {
    this.baseUrl = baseUrl
  }

  async send(req: LlmRequest): Promise<LlmResponse> {
    const messages = this.convertMessages(req)

    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      temperature: req.temperature ?? 0.6,
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }))
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${error}`)
    }

    const data: OpenAIResponse = await response.json()
    return this.convertResponse(data)
  }

  private convertMessages(req: LlmRequest): OpenAIMessage[] {
    const messages: OpenAIMessage[] = []

    if (req.system) {
      messages.push({ role: 'system', content: req.system })
    }

    for (const msg of req.messages) {
      switch (msg.role) {
        case 'system':
          messages.push({ role: 'system', content: msg.content })
          break
        case 'user':
          messages.push({ role: 'user', content: msg.content })
          break
        case 'assistant':
          messages.push({
            role: 'assistant',
            content: msg.content || null,
            ...(msg.toolCalls && msg.toolCalls.length > 0
              ? {
                  tool_calls: msg.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function' as const,
                    function: {
                      name: tc.name,
                      arguments: JSON.stringify(tc.input),
                    },
                  })),
                }
              : {}),
          })
          break
        case 'tool':
          messages.push({
            role: 'tool',
            tool_call_id: msg.toolCallId,
            content: msg.content,
          })
          break
      }
    }

    return messages
  }

  private convertResponse(res: OpenAIResponse): LlmResponse {
    const choice = res.choices[0]
    if (!choice) throw new Error('OpenAI 返回空 choices')

    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => {
      let input: Record<string, unknown> = {}
      try {
        input = JSON.parse(tc.function.arguments)
      } catch {
        // 解析失败保持空对象
      }
      return {
        id: tc.id,
        name: tc.function.name,
        input,
      }
    })

    const usage: LlmUsage = {
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      cacheHitTokens: res.usage?.prompt_tokens_details?.cached_tokens,
    }

    return {
      content: choice.message.content ?? '',
      toolCalls,
      usage,
      stopReason: choice.finish_reason,
      provider: 'openai',
    }
  }
}
