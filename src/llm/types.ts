/**
 * LLM 层中性类型。
 *
 * Provider 无关的请求/响应结构；具体 provider 差异在适配器里翻译。
 */

export type LlmProvider = 'anthropic' | 'openai'

/** LLM 想要调用的工具 */
export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

/** 工具定义的 LLM 视图 */
export interface LlmToolSpec {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/** 中性请求 */
export interface LlmRequest {
  model: string
  system?: string
  messages: LlmMessage[]
  tools?: LlmToolSpec[]
  maxTokens?: number
  temperature?: number
}

/**
 * 判别联合：消息按 role 区分。
 */
export type LlmMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | {
      role: 'tool'
      toolCallId: string
      content: string
      isError?: boolean
    }

/** 中性响应 */
export interface LlmResponse {
  content: string
  toolCalls: ToolCall[]
  usage: LlmUsage
  stopReason: string
  provider: LlmProvider
}

/** Token 用量 */
export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  cacheHitTokens?: number
  cacheMissTokens?: number
}

/** 适配器接口 */
export interface LlmAdapter {
  readonly provider: LlmProvider
  send(req: LlmRequest): Promise<LlmResponse>
}
