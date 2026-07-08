# 代理配置说明

本项目是纯前端应用，所有 API key 由代理层管理，前端代码中不包含任何密钥。

## 开发环境（Vite Proxy）

Vite 内置代理已配置在 `vite.config.ts` 中。启动前设置环境变量：

```bash
# .env（项目根目录，不要提交到 git）
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-xxx
GITHUB_TOKEN=ghp_xxx
VITE_LLM_PROVIDER=openai
VITE_LLM_MODEL=gpt-4o
VITE_GITHUB_USERNAME=your-username
```

然后 `pnpm dev` 即可。Vite 会自动将 `/api/llm/openai/*` 代理到 OpenAI API 并注入 API key。

## 生产环境（Nginx）

参考 `nginx.conf.example`，在 Nginx 配置中注入 API key：

```nginx
location /api/llm/openai/ {
    proxy_pass https://api.openai.com/v1/;
    proxy_set_header Authorization "Bearer ${OPENAI_API_KEY}";
}
```

## 代理路由

| 前端路径 | 代理目标 | 注入的 Header |
|----------|----------|--------------|
| `/api/llm/openai/*` | `https://api.openai.com/v1/*` | `Authorization: Bearer $OPENAI_API_KEY` |
| `/api/llm/anthropic/*` | `https://api.anthropic.com/v1/*` | `x-api-key: $ANTHROPIC_API_KEY` |
| `/api/github/*` | `https://api.github.com/*` | `Authorization: token $GITHUB_TOKEN` |
