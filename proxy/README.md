# 代理配置说明

本项目是纯前端应用，所有 API key 由代理层管理，前端代码中不包含任何密钥。

## 非敏感配置

`public/config.json` 管理运行时配置（部署后可改，无需重新构建）：

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "summaryModel": "",
  "githubUsername": "your-username"
}
```

| 字段 | 说明 |
|------|------|
| `provider` | LLM 提供商：`openai` / `anthropic` |
| `model` | 主对话模型名称 |
| `summaryModel` | 可选，上下文压缩模型（留空则用主模型） |
| `githubUsername` | GitHub 用户名（可选，配置后可搜索仓库） |

## 开发环境（Vite Proxy）

Vite 内置代理已配置在 `vite.config.ts` 中。启动前设置环境变量：

```bash
# .env（项目根目录，不要提交到 git）
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-xxx
GITHUB_TOKEN=ghp_xxx
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
| `/api/webfetch/{encoded-url}` | 动态目标（URL 编码在路径中） | 无 |
