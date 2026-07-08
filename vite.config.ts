import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
    // 读取 .env / .env.local 等文件中的变量
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
                // LLM API 代理 — 开发环境注入 API key
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
