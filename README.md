# Portfolio Agent

一个能回答关于作品集问题的 AI 助手。纯前端项目，Agent Loop 在浏览器运行，API key 由代理层注入。

## 特性

- 🤖 **Agent Loop 架构** — LLM 多轮迭代 + 工具调用
- 🔌 **作品集 API 集成** — 自动解析 OpenAPI/Markdown 文档，通过 API 获取实时数据
- 🔒 **零密钥前端** — API key 由 Vite Proxy / Nginx 注入
- ⚙️ **运行时配置** — `public/config.json` 部署后可改，无需重新构建
- 💬 **实时状态** — 思考中、工具调用、结果反馈
- 🎨 **暗色主题** — Tailwind CSS，适合作品集展示

## 架构

```
前端 (Vue 3)
├── Agent Loop（浏览器端运行）
├── LLM 适配器（OpenAI + Anthropic）
├── 工具系统（web_fetch + search_github）
├── Portfolio API 解析（OpenAPI / Markdown → 归一化端点列表）
└── Session Memory（滑动窗口 + 上下文压缩）

代理层（Vite / Nginx）
└── 注入 API key，转发请求到 LLM / GitHub / 作品集 API

运行时配置（public/config.json）
├── provider / model / summaryModel
├── githubUsername
└── portfolioApi（baseUrl + url/spec 二选一）
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置 API key（代理层使用，不要提交到 git）
cp .env.example .env
# 编辑 .env 填入你的 API key

# 配置运行时参数
cp public/config.json.example public/config.json
# 编辑 public/config.json 填入模型、作品集 API 等

# 启动开发服务器
pnpm dev
```

## 配置

### API 密钥（代理层）

在 `.env` 中设置，由 Vite Proxy / Nginx 注入，前端不读取：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `GITHUB_TOKEN` | GitHub Token |

### 运行时配置（`public/config.json`）

部署后可直接修改，无需重新构建：

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "summaryModel": "",
  "githubUsername": "your-username",
  "portfolioApi": {
    "baseUrl": "https://your-portfolio.com",
    "url": "https://your-portfolio.com/api-docs.md"
  }
}
```

| 字段 | 说明 |
|------|------|
| `provider` | LLM 提供商：`openai` / `anthropic` |
| `model` | 主对话模型 |
| `summaryModel` | 可选，上下文压缩模型 |
| `githubUsername` | 可选，GitHub 用户名 |
| `portfolioApi.baseUrl` | 作品集 API 基础地址（必填，当配置了 portfolioApi 时） |
| `portfolioApi.url` | API 文档 URL（OpenAPI JSON 或 Markdown），与 `spec` 二选一 |
| `portfolioApi.spec` | 直接写入 OpenAPI JSON，与 `url` 二选一 |

## 工具

| 工具 | 说明 |
|------|------|
| `web_fetch` | 抓取任意 URL 内容（通过代理），用于调用作品集 API、读取网页 |
| `search_github` | 搜索 GitHub 仓库信息 |

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Tailwind CSS
- **LLM**: OpenAI API / Anthropic API（双适配器）
- **架构**: Agent Loop + Tool System + Session Memory + 子代理（Markdown 解析）
- **参考**: sse-demo（SSE 封装）、docforge（Agent 核心）

## 生产部署

构建后部署为静态文件，配合 Nginx 代理：

```bash
pnpm build
# dist/ 目录为构建产物
# 配置 Nginx 代理 API 请求（参考 proxy/nginx.conf.example）
```

## License

MIT
