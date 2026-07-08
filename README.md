# Portfolio Agent

一个能回答关于作品集问题的 AI 助手。纯前端项目，Agent Loop 在浏览器运行，API key 由代理层注入。

## 特性

- 🤖 **Agent Loop 架构** — LLM 多轮迭代 + 工具调用
- 🔧 **4 个专属工具** — 作品集读取、项目列表、GitHub 搜索、内容搜索
- 🔒 **零密钥前端** — API key 由 Vite Proxy / Nginx 注入
- 💬 **实时状态** — 思考中、工具调用、结果反馈
- 🎨 **暗色主题** — Tailwind CSS，适合作品集展示

## 架构

```
前端 (Vue 3)
├── Agent Loop（浏览器端运行）
├── LLM 适配器（OpenAI + Anthropic）
├── 工具系统（4 个内置工具）
└── Session Memory（滑动窗口）

代理层（Vite / Nginx）
└── 注入 API key，转发请求到 LLM API
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量（参考 .env.example）
cp .env.example .env
# 编辑 .env 填入你的 API key

# 启动开发服务器
pnpm dev
```

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI API Key | 使用 OpenAI 时必填 |
| `ANTHROPIC_API_KEY` | Anthropic API Key | 使用 Anthropic 时必填 |
| `VITE_LLM_PROVIDER` | LLM 提供商 (`openai` / `anthropic`) | 否，默认 `openai` |
| `VITE_LLM_MODEL` | 模型名称 | 否，默认 `gpt-4o` |
| `VITE_GITHUB_USERNAME` | GitHub 用户名 | 否，配置后可搜索仓库 |

## 自定义作品集数据

编辑 `portfolio-data/` 目录下的 JSON 文件：

- `profile.json` — 个人简介、经历、教育
- `projects.json` — 项目列表（名称、描述、技术栈、亮点）
- `skills.json` — 技能栈（按类别分组）

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Tailwind CSS
- **LLM**: OpenAI API / Anthropic API（双适配器）
- **架构**: Agent Loop + Tool System + Session Memory
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
