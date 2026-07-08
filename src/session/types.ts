/**
 * 会话模块类型。
 */

import type { LlmMessage } from '@/llm/types'

export interface SessionMemory {
    recentMessages: LlmMessage[]
    maxRecent: number
    taskSummary: string
    projectContext: {
        constraints: string[]
        findings: string[]
    }
}

/**
 * 持久化格式。
 */
export interface SessionData {
    version: 1
    savedAt: string
    memory: SessionMemory
}
