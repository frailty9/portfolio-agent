/**
 * 环境变量工具
 *
 * 前端只读取非敏感配置。API key 由代理层注入。
 */

export const BASE_URL = import.meta.env.VITE_API_BASE || ''

export const LLM_PROVIDER = import.meta.env.VITE_LLM_PROVIDER || 'openai'
export const LLM_MODEL = import.meta.env.VITE_LLM_MODEL || 'gpt-4o'
export const GITHUB_USERNAME = import.meta.env.VITE_GITHUB_USERNAME || ''
