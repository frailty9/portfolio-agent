import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [vue()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        server: {
            proxy: {
                // LLM API 代理
                '/api/llm/openai': {
                    target: env.OPENAI_BASE_URL || 'https://api.openai.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api\/llm\/openai/, '/v1'),
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq) => {
                            if (env.OPENAI_API_KEY) {
                                proxyReq.setHeader('Authorization', `Bearer ${env.OPENAI_API_KEY}`);
                            }
                        });
                    },
                },
                '/api/llm/anthropic': {
                    target: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api\/llm\/anthropic/, '/v1'),
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq) => {
                            if (env.ANTHROPIC_API_KEY) {
                                proxyReq.setHeader('x-api-key', env.ANTHROPIC_API_KEY);
                                proxyReq.setHeader('anthropic-version', '2023-06-01');
                            }
                        });
                    },
                },
                // GitHub API 代理
                '/api/github': {
                    target: 'https://api.github.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api\/github/, ''),
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq) => {
                            if (env.GITHUB_TOKEN) {
                                proxyReq.setHeader('Authorization', `token ${env.GITHUB_TOKEN}`);
                            }
                        });
                    },
                },
                // Web Fetch 代理 — 动态目标，URL 编码在路径中
                // 前端调用: /api/webfetch/https%3A%2F%2Fexample.com/path
                '/api/webfetch': {
                    target: 'http://localhost:0', // 占位，实际由 configure 动态设置
                    changeOrigin: true,
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq, req) => {
                            // 从请求路径中提取目标 URL
                            const raw = req.url?.replace(/^\/api\/webfetch\//, '') ?? '';
                            const decoded = decodeURIComponent(raw);
                            try {
                                const url = new URL(decoded);
                                // 重写请求路径为目标 URL 的 path + search
                                proxyReq.path = url.pathname + url.search;
                                // 动态切换 target
                                proxyReq.setHeader('host', url.host);
                            } catch {
                                // URL 解析失败，保持原样
                            }
                        });
                        // 动态设置 target
                        proxy.on('proxyReqWs', (_proxyReq, _req, _socket, _options, _head) => {
                            // noop
                        });
                    },
                    router: (req) => {
                        // 从请求路径中提取目标 URL 的 origin
                        const raw = req.url?.replace(/^\/api\/webfetch\//, '') ?? '';
                        const decoded = decodeURIComponent(raw);
                        try {
                            const url = new URL(decoded);
                            return url.origin;
                        } catch {
                            return 'https://example.com';
                        }
                    },
                },
            },
        },
    };
});
