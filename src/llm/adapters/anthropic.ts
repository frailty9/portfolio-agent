/**
 * Anthropic 适配器。
 *
 * 通过 /api/llm/anthropic 代理转发，前端不持有 API key。
 */

import type { LlmAdapter, LlmRequest, LlmResponse, LlmUsage } from '../types'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | Array<AnthropicContentBlock>
}

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use'
      id: string
      name: string
      input: Record<string, unknown>
    }
  | {
      type: 'tool_result'
      tool_use_id: string
      content: string
      is_error?: boolean
    }

interface AnthropicResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export class AnthropicAdapter implements LlmAdapter {
  readonly provider = 'anthropic'
  private baseUrl: string

  constructor(baseUrl = '/api/llm/anthropic') {
    this.baseUrl = baseUrl
  }

  async send(req: LlmRequest): Promise<LlmResponse> {
    const { system, messages } = this.convertMessages(req)

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
      ...(system ? { system } : {}),
      ...(req.temperature ? { temperature: req.temperature } : {}),
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }))
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error (${response.status}): ${error}`)
    }

    const data: AnthropicResponse = await response.json()
    return this.convertResponse(data)
  }

  private convertMessages(req: LlmRequest): {
    system: string | null
    messages: AnthropicMessage[]
  } {
    const systemParts: string[] = []
    if (req.system) systemParts.push(req.system)

    const messages: AnthropicMessage[] = []

    for (const msg of req.messages) {
      switch (msg.role) {
        case 'system':
          systemParts.push(msg.content)
          break
        case 'user':
          messages.push({ role: 'user', content: msg.content })
          break
        case 'assistant': {
          const content: AnthropicContentBlock[] = []
          if (msg.content) {
            content.push({ type: 'text', text: msg.content })
          }
          if (msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
            }
          }
          messages.push({ role: 'assistant', content })
          break
        }
        case 'tool':
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: msg.toolCallId,
                content: msg.content,
                is_error: msg.isError,
              },
            ],
          })
          break
      }
    }

    return {
      system: systemParts.length > 0 ? systemParts.join('\n\n') : null,
      messages,
    }
  }

  private convertResponse(res: AnthropicResponse): LlmResponse {
    const textParts: string[] = []
    const toolCalls: LlmResponse['toolCalls'] = []

    for (const block of res.content) {
      if (block.type === 'text') {
        textParts.push(block.text)
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        })
      }
    }

    const usage: LlmUsage = {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheHitTokens: res.usage.cache_read_input_tokens,
      cacheMissTokens: res.usage.cache_creation_input_tokens,
    }

    return {
      content: textParts.join(''),
      toolCalls,
      usage,
      stopReason: res.stop_reason,
      provider: 'anthropic',
    }
  }
}
