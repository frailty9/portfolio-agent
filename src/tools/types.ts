/**
 * 工具系统核心类型。
 *
 * 内部统一抽象，不绑定到任何 LLM 提供商。
 */

export type JsonSchema = Record<string, unknown>

export type ToolDefinition<TParams = unknown, TResult = unknown> = {
  name: string
  description: string
  inputSchema: JsonSchema
  execute: (ctx: ToolContext, params: TParams) => Promise<TResult>
}

export interface ToolSpec {
  name: string
  description: string
  inputSchema: JsonSchema
}

/** 工具执行上下文 */
export interface ToolContext {
  /** GitHub 用户名（可选） */
  githubUsername?: string
}

export class InvalidParamsError extends Error {
  code = 'INVALID_PARAMS' as const
  constructor(message: string) {
    super(`参数无效: ${message}`)
    this.name = 'InvalidParamsError'
  }
}

export class ToolExecutionError extends Error {
  code = 'TOOL_ERROR' as const
  constructor(message: string) {
    super(message)
    this.name = 'ToolExecutionError'
  }
}
