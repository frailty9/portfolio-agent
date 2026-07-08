import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            vue(),
            // Web Fetch 中间件 — 服务端代理，解决 CORS
            {
                name: 'webfetch-middleware',
                configureServer(server) {
                    server.middlewares.use('/api/webfetch/', async (req, res) => {
                        // 从路径中提取目标 URL
                        const raw = req.url?.replace(/^\//, '') ?? '';
                        const decoded = decodeURIComponent(raw);

                        let targetUrl: URL;
                        try {
                            targetUrl = new URL(decoded);
                        } catch {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ error: `无效的 URL: ${decoded}` }));
                            return;
                        }

                        try {
                            const response = await fetch(targetUrl.href, {
                                method: 'GET',
                                headers: {
                                    'User-Agent': 'PortfolioAgent/1.0',
                                    Accept: 'text/html, text/plain, application/json, */*',
                                },
                                redirect: 'follow',
                                signal: AbortSignal.timeout(15000),
                            });

                            res.statusCode = response.status;
                            res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/plain');
                            res.setHeader('Access-Control-Allow-Origin', '*');

                            const body = await response.text();
                            res.end(body);
                        } catch (err) {
                            res.statusCode = 502;
                            res.end(
                                JSON.stringify({
                                    error: `代理请求失败: ${err instanceof Error ? err.message : String(err)}`,
                                }),
                            );
                        }
                    });
                },
            },
        ],
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
            },
        },
    };
});
