import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
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
        target: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llm\/openai/, '/v1'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (process.env.OPENAI_API_KEY) {
              proxyReq.setHeader('Authorization', `Bearer ${process.env.OPENAI_API_KEY}`)
            }
          })
        },
      },
      '/api/llm/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llm\/anthropic/, '/v1'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (process.env.ANTHROPIC_API_KEY) {
              proxyReq.setHeader('x-api-key', process.env.ANTHROPIC_API_KEY)
              proxyReq.setHeader('anthropic-version', '2023-06-01')
            }
          })
        },
      },
      // GitHub API 代理
      '/api/github': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/github/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (process.env.GITHUB_TOKEN) {
              proxyReq.setHeader('Authorization', `token ${process.env.GITHUB_TOKEN}`)
            }
          })
        },
      },
    },
  },
})
