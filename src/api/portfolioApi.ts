/**
 * 作品集 API 解析主逻辑。
 *
 * 入口：resolvePortfolioApi(config)
 * - { spec } → parseOpenApiSpec() 纯代码解析
 * - { url }  → fetchAndParseApiUrl() 拉取 → 判断格式 → 分发
 *
 * Markdown 文档的 LLM 子代理调用在 markdownSubAgent.ts。
 */

import type { PortfolioApiEndpoint } from '@/session/types';
import type { PortfolioApiConfig } from '@/utils/env';
import { parseMarkdownWithSubAgent } from './markdownSubAgent';

// ============================================================================
// 公共入口
// ============================================================================

/**
 * 解析作品集 API 配置，返回归一化的端点列表。
 */
export async function resolvePortfolioApi(
    config: PortfolioApiConfig,
): Promise<PortfolioApiEndpoint[]> {
    if ('spec' in config && config.spec) {
        return parseOpenApiSpec(config.spec);
    }
    if ('url' in config && config.url) {
        return fetchAndParseApiUrl(config.url);
    }
    throw new Error('portfolioApi 配置无效：缺少 url 或 spec');
}

// ============================================================================
// OpenAPI 确定性解析
// ============================================================================

/**
 * 从 OpenAPI spec JSON 中提取端点列表。
 * 纯代码，零 LLM 调用。
 */
export function parseOpenApiSpec(spec: unknown): PortfolioApiEndpoint[] {
    if (!spec || typeof spec !== 'object') {
        throw new Error('OpenAPI spec 必须是对象');
    }

    const s = spec as Record<string, unknown>;
    const paths = s.paths as Record<string, Record<string, unknown>> | undefined;
    if (!paths || typeof paths !== 'object') {
        throw new Error('OpenAPI spec 缺少 paths 字段');
    }

    const endpoints: PortfolioApiEndpoint[] = [];
    const SUPPORTED_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

    for (const [path, methods] of Object.entries(paths)) {
        if (!methods || typeof methods !== 'object') continue;

        for (const [method, operation] of Object.entries(methods)) {
            if (!SUPPORTED_METHODS.includes(method)) continue;
            if (!operation || typeof operation !== 'object') continue;

            const op = operation as Record<string, unknown>;
            const endpoint: PortfolioApiEndpoint = {
                method: method.toUpperCase() as PortfolioApiEndpoint['method'],
                path,
                summary:
                    typeof op.summary === 'string'
                        ? op.summary
                        : typeof op.description === 'string'
                          ? op.description.slice(0, 100)
                          : path,
            };

            if (typeof op.description === 'string') {
                endpoint.description = op.description;
            }

            // 提取 parameters
            const params = op.parameters;
            if (Array.isArray(params)) {
                endpoint.parameters = params
                    .filter((p) => p && typeof p === 'object')
                    .map((p) => {
                        const param = p as Record<string, unknown>;
                        return {
                            name: String(param.name ?? ''),
                            in: ((param.in as string) ?? 'query') as 'query' | 'path' | 'header' | 'body',
                            type: String(
                                (param.schema as Record<string, unknown>)?.type ?? 'string',
                            ),
                            description:
                                typeof param.description === 'string'
                                    ? param.description
                                    : undefined,
                            required: param.required === true,
                        };
                    })
                    .filter((p) => p.name);
            }

            endpoints.push(endpoint);
        }
    }

    return endpoints;
}

// ============================================================================
// URL 拉取 + 格式判断 + 分发
// ============================================================================

async function fetchAndParseApiUrl(url: string): Promise<PortfolioApiEndpoint[]> {
    // 1. 拉取内容
    const response = await fetch(`/api/webfetch/${encodeURIComponent(url)}`);
    if (!response.ok) {
        throw new Error(`拉取 API 文档失败 (${response.status}): ${url}`);
    }
    const raw = await response.text();

    // 2. 判断格式
    const format = detectFormat(raw);

    if (format === 'openapi') {
        try {
            const json = JSON.parse(raw);
            return parseOpenApiSpec(json);
        } catch (err) {
            throw new Error(
                `OpenAPI JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    // 3. Markdown 路径
    const cleaned = stripHtml(raw);
    const normalized = normalizeMarkdown(cleaned);
    return parseMarkdownWithSubAgent(normalized);
}

/**
 * 判断内容是 OpenAPI JSON 还是 Markdown。
 */
function detectFormat(raw: string): 'openapi' | 'markdown' {
    const trimmed = raw.trim();

    // 尝试 JSON 解析
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (
                parsed &&
                typeof parsed === 'object' &&
                ('openapi' in parsed || 'swagger' in parsed || 'paths' in parsed)
            ) {
                return 'openapi';
            }
        } catch {
            // 不是合法 JSON，继续判断
        }
    }

    return 'markdown';
}

// ============================================================================
// HTML 清理 + Markdown 规范化
// ============================================================================

/**
 * 去除 HTML 标签，保留文本内容。
 * 处理常见的 HTML 文档结构。
 */
export function stripHtml(html: string): string {
    return (
        html
            // 先处理 block 标签为换行
            .replace(/<\/(div|p|section|article|li|h[1-6]|tr|blockquote)>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?(tr|thead|tbody)>/gi, '\n')
            .replace(/<hr\s*\/?>/gi, '\n---\n')
            // 去掉 script/style/nav/footer/header
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            // 保留 code 块内容
            .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => `\n\`\`\`\n${code}\n\`\`\`\n`)
            .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
            // 保留链接文本
            .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
            // 保留图片 alt
            .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '[$1]')
            // 去掉所有剩余标签
            .replace(/<[^>]+>/g, '')
            // 解码 HTML 实体
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            // 规范化空白
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    );
}

/**
 * 规范化 Markdown：统一标题格式、清理多余空行。
 */
function normalizeMarkdown(md: string): string {
    return (
        md
            // 统一标题格式：确保 # 后有空格
            .replace(/^(#{1,6})([^\s#])/gm, '$1 $2')
            // 去掉行尾空格
            .replace(/[ \t]+$/gm, '')
            // 规范化连续空行
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    );
}

// ============================================================================
// 文档分片
// ============================================================================

export interface DocSection {
    title: string;
    level: number;
    content: string;
    index: number;
}

/**
 * 按 Markdown 标题切片。
 * 返回 Section 数组，每个包含标题、层级、内容、索引。
 */
export function splitByHeaders(markdown: string): DocSection[] {
    const lines = markdown.split('\n');
    const sections: DocSection[] = [];
    let current: DocSection | null = null;

    for (const line of lines) {
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            // 保存上一个 section
            if (current) {
                current.content = current.content.trim();
                if (current.content) {
                    sections.push(current);
                }
            }
            current = {
                title: headerMatch[2]!.trim(),
                level: headerMatch[1]!.length,
                content: '',
                index: sections.length,
            };
        } else if (current) {
            current.content += line + '\n';
        } else {
            // 文档开头、标题之前的内容
            current = {
                title: '(前言)',
                level: 0,
                content: line + '\n',
                index: sections.length,
            };
        }
    }

    // 保存最后一个 section
    if (current) {
        current.content = current.content.trim();
        if (current.content) {
            sections.push(current);
        }
    }

    return sections;
}

/**
 * 按段落切片（fallback：无标题时使用）。
 * 每个段落由连续空行分隔。
 */
export function splitByParagraphs(text: string, maxChars = 4000): DocSection[] {
    const paragraphs = text.split(/\n{2,}/);
    const sections: DocSection[] = [];
    let current: DocSection | null = null;
    let currentLen = 0;

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        if (!current || currentLen + trimmed.length > maxChars) {
            if (current) {
                current.content = current.content.trim();
                if (current.content) {
                    sections.push(current);
                }
            }
            current = {
                title: `(段落 ${sections.length + 1})`,
                level: 0,
                content: trimmed + '\n\n',
                index: sections.length,
            };
            currentLen = trimmed.length;
        } else {
            current.content += trimmed + '\n\n';
            currentLen += trimmed.length;
        }
    }

    if (current) {
        current.content = current.content.trim();
        if (current.content) {
            sections.push(current);
        }
    }

    return sections;
}
