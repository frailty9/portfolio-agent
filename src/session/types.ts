/**
 * 会话模块类型。
 */

import type { LlmMessage } from '@/llm/types';

/** 作品集 API 端点归一化格式 */
export interface PortfolioApiEndpoint {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    summary: string;
    description?: string;
    parameters?: Array<{
        name: string;
        in: 'query' | 'path' | 'header' | 'body';
        type: string;
        description?: string;
        required?: boolean;
    }>;
}

export interface SessionMemory {
    recentMessages: LlmMessage[];
    maxRecent: number;
    taskSummary: string;
    projectContext: {
        constraints: string[];
        findings: string[];
        portfolioApis: PortfolioApiEndpoint[];
        portfolioApiBaseUrl: string;
    };
}

/**
 * 展示层消息（持久化用，与 LLM 上下文独立）。
 */
export interface DisplayMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    toolCalls?: Array<{
        name: string;
        input: unknown;
        ok?: boolean;
        preview?: string;
    }>;
}

/**
 * 持久化格式。
 */
export interface SessionData {
    version: 1;
    savedAt: string;
    memory: SessionMemory;
    displayMessages?: DisplayMessage[];
}
