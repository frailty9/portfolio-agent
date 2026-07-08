/**
 * LLM 业务编排层。
 *
 * 根据配置选择 provider / model，调用对应适配器。
 * 支持主模型 + 摘要模型分离。
 */

import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';
import type { LlmAdapter, LlmMessage, LlmRequest, LlmResponse, LlmToolSpec } from './types';

export interface ChatOptions {
    provider?: 'openai' | 'anthropic';
    model?: string;
    tools?: LlmToolSpec[];
    temperature?: number;
    maxTokens?: number;
}

const TEMPERATURE = {
    reasoning: 0.2,
    generation: 0.6,
    summary: 0.3,
} as const;

let defaultAdapter: LlmAdapter | null = null;
let defaultProvider: 'openai' | 'anthropic' = 'anthropic';
let defaultModel = '';
let defaultSummaryModel = '';

export function setDefaultProvider(
    provider: 'openai' | 'anthropic',
    model?: string,
    summaryModel?: string,
) {
    defaultProvider = provider;
    defaultAdapter = provider === 'anthropic' ? new AnthropicAdapter() : new OpenAIAdapter();
    if (model) defaultModel = model;
    if (summaryModel) defaultSummaryModel = summaryModel;
}

export function getDefaultAdapter(): LlmAdapter {
    if (!defaultAdapter) {
        defaultAdapter =
            defaultProvider === 'anthropic' ? new AnthropicAdapter() : new OpenAIAdapter();
    }
    return defaultAdapter;
}

export function getDefaultModel(): string {
    return defaultModel;
}

function resolveAdapter(provider?: 'openai' | 'anthropic'): LlmAdapter {
    if (!provider) return getDefaultAdapter();
    return provider === 'anthropic' ? new AnthropicAdapter() : new OpenAIAdapter();
}

/**
 * 单次聊天：调一次 LLM 拿一次补全。
 */
export async function chat(messages: LlmMessage[], options: ChatOptions = {}): Promise<LlmResponse> {
    if (messages.length === 0) {
        throw new Error('messages 不能为空');
    }

    const adapter = resolveAdapter(options.provider);
    const model = options.model ?? getDefaultModel();
    const { system, rest } = splitSystemMessages(messages);

    const req: LlmRequest = {
        model,
        messages: rest,
        temperature: options.temperature ?? TEMPERATURE.generation,
        ...(system ? { system } : {}),
        ...(options.tools ? { tools: options.tools } : {}),
        ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
    };

    return adapter.send(req);
}

/**
 * 摘要/压缩：用 summaryModel（如果配置了）对消息生成摘要。
 * 回退到主模型。
 */
export async function summarize(
    messages: LlmMessage[],
    provider?: 'openai' | 'anthropic',
): Promise<LlmResponse> {
    const model = defaultSummaryModel || getDefaultModel();
    return chat(messages, {
        provider,
        model,
        temperature: TEMPERATURE.summary,
    });
}

function splitSystemMessages(messages: LlmMessage[]): {
    system: string | null;
    rest: LlmMessage[];
} {
    const systemParts: string[] = [];
    let i = 0;
    while (i < messages.length && messages[i].role === 'system') {
        systemParts.push(messages[i].content);
        i++;
    }
    return {
        system: systemParts.length > 0 ? systemParts.join('\n\n') : null,
        rest: messages.slice(i),
    };
}
