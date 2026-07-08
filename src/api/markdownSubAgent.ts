/**
 * Markdown 子代理：用 LLM 从 Markdown 文档中提取 API 端点。
 *
 * 两阶段 Loop（不走 Agent Loop，直接调 chat()）：
 *   Phase 1：喂标题列表 → LLM 返回"哪些 section 可能有 API"的索引数组
 *   Phase 2：逐个喂相关 section → 每个返回 PortfolioApiEndpoint[]
 *
 * 硬约束：
 * - 子代理禁止调用 resolvePortfolioApi / fetchAndParseApiUrl
 * - 子代理不可再开孙级代理
 * - 使用 summaryModel（便宜、快速）
 * - 最多处理 MAX_SECTIONS 个切片
 */

import { chat } from '@/llm/index';
import { splitByHeaders, splitByParagraphs, type DocSection } from './portfolioApi';
import { SECTION_INDEX_PROMPT, API_EXTRACT_PROMPT } from '@/prompt/portfolioApi';
import type { PortfolioApiEndpoint } from '@/session/types';
import type { LlmMessage } from '@/llm/types';

const MAX_SECTIONS = 20;

/**
 * 解析 Markdown 文档，提取 API 端点列表。
 */
export async function parseMarkdownWithSubAgent(
    markdown: string,
): Promise<PortfolioApiEndpoint[]> {
    // Phase 0: 分片
    let sections = splitByHeaders(markdown);
    if (sections.length === 0) {
        // 无标题，fallback 到段落切片
        sections = splitByParagraphs(markdown);
    }
    if (sections.length === 0) {
        return [];
    }

    // 限制切片数
    const cappedSections = sections.slice(0, MAX_SECTIONS);
    const totalSections = sections.length;

    // Phase 1: 目录索引 — 让 LLM 判断哪些 section 可能包含 API
    const relevantIndices = await getRelevantSectionIndices(cappedSections);

    // 如果 LLM 返回空或全选，fallback 到全部扫描
    const sectionsToScan =
        relevantIndices.length > 0
            ? relevantIndices
                  .filter((i) => i >= 0 && i < cappedSections.length)
                  .map((i) => cappedSections[i]!)
            : cappedSections;

    // Phase 2: 逐片提取
    const allEndpoints: PortfolioApiEndpoint[] = [];
    for (const section of sectionsToScan) {
        const endpoints = await extractApiFromSection(section);
        allEndpoints.push(...endpoints);
    }

    // 去重（method + path）
    return deduplicateEndpoints(allEndpoints);
}

// ============================================================================
// Phase 1: 目录索引
// ============================================================================

async function getRelevantSectionIndices(sections: DocSection[]): Promise<number[]> {
    const titleList = sections
        .map((s) => `${s.index}: ${'#'.repeat(s.level)} ${s.title}`)
        .join('\n');

    const messages: LlmMessage[] = [
        { role: 'system', content: SECTION_INDEX_PROMPT },
        { role: 'user', content: titleList },
    ];

    try {
        const result = await chat(messages, { temperature: 0.1 });
        const parsed = parseIntArray(result.content);
        return parsed;
    } catch {
        // 子代理失败时 fallback 到全部扫描
        return [];
    }
}

/**
 * 从 LLM 响应中解析 JSON 数组。
 * 容错：尝试提取 JSON 片段。
 */
function parseIntArray(text: string): number[] {
    const trimmed = text.trim();

    // 直接尝试 JSON.parse
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
            return parsed;
        }
    } catch {
        // 继续
    }

    // 尝试提取 [...] 片段
    const match = trimmed.match(/\[[\d\s,]+\]/);
    if (match) {
        try {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) {
                return parsed.filter((n) => typeof n === 'number');
            }
        } catch {
            // 继续
        }
    }

    return [];
}

// ============================================================================
// Phase 2: 逐片提取
// ============================================================================

async function extractApiFromSection(section: DocSection): Promise<PortfolioApiEndpoint[]> {
    // 截断过长的 section 内容
    const maxChars = 8000;
    const content =
        section.content.length > maxChars
            ? section.content.slice(0, maxChars) + '\n[...截断]'
            : section.content;

    const userContent = `## ${section.title}\n\n${content}`;

    const messages: LlmMessage[] = [
        { role: 'system', content: API_EXTRACT_PROMPT },
        { role: 'user', content: userContent },
    ];

    try {
        const result = await chat(messages, { temperature: 0.1 });
        return parseEndpoints(result.content);
    } catch {
        return [];
    }
}

/**
 * 从 LLM 响应中解析 PortfolioApiEndpoint[]。
 * 容错：尝试提取 JSON 片段。
 */
function parseEndpoints(text: string): PortfolioApiEndpoint[] {
    const trimmed = text.trim();

    // 直接尝试 JSON.parse
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return validateEndpoints(parsed);
        }
    } catch {
        // 继续
    }

    // 尝试提取 [...] 片段
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) {
        try {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) {
                return validateEndpoints(parsed);
            }
        } catch {
            // 继续
        }
    }

    return [];
}

/**
 * 验证并清理端点数据。
 */
function validateEndpoints(items: unknown[]): PortfolioApiEndpoint[] {
    const VALID_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    return items
        .filter((item): item is Record<string, unknown> => {
            if (!item || typeof item !== 'object') return false;
            const m = String(item.method ?? '').toUpperCase();
            return VALID_METHODS.includes(m) && typeof item.path === 'string';
        })
        .map((item) => {
            const endpoint: PortfolioApiEndpoint = {
                method: String(item.method).toUpperCase() as PortfolioApiEndpoint['method'],
                path: String(item.path),
                summary: typeof item.summary === 'string' ? item.summary : String(item.path),
            };
            if (typeof item.description === 'string') {
                endpoint.description = item.description;
            }
            if (Array.isArray(item.parameters)) {
                endpoint.parameters = item.parameters
                    .filter((p) => p && typeof p === 'object' && typeof (p as Record<string, unknown>).name === 'string')
                    .map((p) => {
                        const param = p as Record<string, unknown>;
                        return {
                            name: String(param.name),
                            in: (String(param.in ?? 'query') as 'query' | 'path' | 'header' | 'body'),
                            type: String(param.type ?? 'string'),
                            description:
                                typeof param.description === 'string'
                                    ? param.description
                                    : undefined,
                            required: param.required === true,
                        };
                    });
            }
            return endpoint;
        });
}

// ============================================================================
// 去重
// ============================================================================

function deduplicateEndpoints(endpoints: PortfolioApiEndpoint[]): PortfolioApiEndpoint[] {
    const seen = new Set<string>();
    return endpoints.filter((ep) => {
        const key = `${ep.method} ${ep.path}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
