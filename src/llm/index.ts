/**
 * LLM 业务编排层。
 *
 * 根据配置选择 provider / model，调用对应适配器。
 */

import { OpenAIAdapter } from './adapters/openai'
import { AnthropicAdapter } from './adapters/anthropic'
import type { LlmAdapter, LlmMessage, LlmRequest, LlmResponse, LlmToolSpec } from './types'

export interface ChatOptions {
  provider?: 'openai' | 'anthropic'
  model?: string
  tools?: LlmToolSpec[]
  temperature?: number
  maxTokens?: number
}

const TEMPERATURE = {
  reasoning: 0.2,
  generation: 0.6,
} as const

let defaultAdapter: LlmAdapter | null = null
let defaultModel = 'gpt-4o'

export function setDefaultProvider(provider: 'openai' | 'anthropic', model?: string) {
  defaultAdapter = provider === 'anthropic' ? new AnthropicAdapter() : new OpenAIAdapter()
  if (model) defaultModel = model
}

export function getDefaultAdapter(): LlmAdapter {
  if (!defaultAdapter) {
    defaultAdapter = new OpenAIAdapter()
  }
  return defaultAdapter
}

export function getDefaultModel(): string {
  return defaultModel
}

/**
 * 单次聊天：调一次 LLM 拿一次补全。
 */
export async function chat(
  messages: LlmMessage[],
  options: ChatOptions = {},
): Promise<LlmResponse> {
  if (messages.length === 0) {
    throw new Error('messages 不能为空')
  }

  const adapter = options.provider === 'anthropic'
    ? new AnthropicAdapter()
    : options.provider === 'openai'
      ? new OpenAIAdapter()
      : getDefaultAdapter()

  const model = options.model ?? getDefaultModel()
  const { system, rest } = splitSystemMessages(messages)

  const req: LlmRequest = {
    model,
    messages: rest,
    temperature: options.temperature ?? TEMPERATURE.generation,
    ...(system ? { system } : {}),
    ...(options.tools ? { tools: options.tools } : {}),
    ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
  }

  return adapter.send(req)
}

function splitSystemMessages(messages: LlmMessage[]): {
  system: string | null
  rest: LlmMessage[]
} {
  const systemParts: string[] = []
  let i = 0
  while (i < messages.length && messages[i].role === 'system') {
    systemParts.push(messages[i].content)
    i++
  }
  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : null,
    rest: messages.slice(i),
  }
}
