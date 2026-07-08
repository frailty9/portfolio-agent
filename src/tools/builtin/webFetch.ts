/**
 * Web Fetch — 抓取 URL 内容。
 *
 * 通过 /api/webfetch 代理转发（避免 CORS）。
 * URL 编码在路径中，代理动态切换目标。
 *
 * 安全约束：
 * - 仅允许 http / https
 * - 超时控制
 * - 响应体大小限制
 */

import type { ToolDefinition } from '../types';

interface WebFetchParams {
    /** URL，必须以 http:// 或 https:// 开头 */
    url: string;
    /** 响应体最大字节数；默认 512 KiB */
    maxBytes?: number;
    /** 超时（毫秒）；默认 15000 */
    timeoutMs?: number;
}

interface WebFetchResult {
    url: string;
    finalUrl: string;
    status: number;
    contentType: string;
    body: string;
    bytes: number;
    truncated: boolean;
}

const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 60_000;

export const webFetchTool: ToolDefinition<WebFetchParams, WebFetchResult> = {
    name: 'web_fetch',
    description:
        '用 HTTP GET 抓取 URL 内容并返回文本。仅支持 http/https。' +
        '超时默认 15s，响应体默认最大 512 KiB。' +
        '可用于读取博客文章、文档页面、GitHub README 等。',
    inputSchema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: '必须以 http:// 或 https:// 开头的 URL',
            },
            maxBytes: {
                type: 'integer',
                description: `响应体最大字节数；默认 ${DEFAULT_MAX_BYTES}`,
            },
            timeoutMs: {
                type: 'integer',
                description: `超时（毫秒）；默认 ${DEFAULT_TIMEOUT_MS}，最大 ${MAX_TIMEOUT_MS}`,
            },
        },
        required: ['url'],
    },
    async execute(_ctx, params) {
        // 协议校验
        let parsed: URL;
        try {
            parsed = new URL(params.url);
        } catch {
            throw new Error(`无效的 URL: ${params.url}`);
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error(`仅支持 http/https 协议，当前: ${parsed.protocol}`);
        }

        const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES;
        const timeoutMs = Math.min(
            Math.max(params.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1),
            MAX_TIMEOUT_MS,
        );

        // 通过代理请求：/api/webfetch/{encoded-url}
        const proxyUrl = `/api/webfetch/${encodeURIComponent(params.url)}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
            response = await fetch(proxyUrl, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    Accept: 'text/html, text/plain, application/json, */*',
                },
            });
        } catch (err) {
            clearTimeout(timer);
            if (err instanceof Error && err.name === 'AbortError') {
                throw new Error(`请求超时 (>${timeoutMs}ms): ${params.url}`);
            }
            throw new Error(`请求失败: ${err instanceof Error ? err.message : String(err)}`);
        }

        // 读 body，按大小截断
        const contentType = response.headers.get('content-type') ?? '';
        let bodyText = '';
        let truncated = false;
        const reader = response.body?.getReader();
        if (reader) {
            const chunks: Uint8Array[] = [];
            let received = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    received += value.byteLength;
                    if (received > maxBytes) {
                        const remaining = maxBytes - (received - value.byteLength);
                        if (remaining > 0) {
                            chunks.push(value.slice(0, remaining));
                        }
                        truncated = true;
                        try {
                            await reader.cancel();
                        } catch {
                            // ignore
                        }
                        break;
                    }
                    chunks.push(value);
                }
            }
            clearTimeout(timer);
            const buf = new Uint8Array(chunks.reduce((acc, c) => acc + c.byteLength, 0));
            let offset = 0;
            for (const chunk of chunks) {
                buf.set(chunk, offset);
                offset += chunk.byteLength;
            }
            bodyText = new TextDecoder().decode(buf);
        } else {
            clearTimeout(timer);
        }

        // 如果是 HTML，做基础清理（去 script/style 标签）
        if (contentType.includes('text/html')) {
            bodyText = stripHtml(bodyText);
        }

        return {
            url: params.url,
            finalUrl: response.url,
            status: response.status,
            contentType,
            body: bodyText,
            bytes: new TextEncoder().encode(bodyText).byteLength,
            truncated,
        };
    },
};

/**
 * 基础 HTML 清理：去标签、script、style，保留纯文本。
 */
function stripHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100_000); // 硬上限 100K 字符
}
