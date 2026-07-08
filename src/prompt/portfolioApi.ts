/**
 * 子代理 Prompt 模板。
 *
 * 两个阶段：
 * 1. 目录索引 — 从标题列表中判断哪些 section 可能包含 API 信息
 * 2. 逐片提取 — 从单个 section 中提取 PortfolioApiEndpoint[]
 *
 * 硬约束：子代理不可再开孙级代理。
 */

/**
 * Phase 1：目录索引 prompt。
 * 输入：标题列表（带索引号）
 * 输出：JSON 数组，包含相关 section 的索引号
 */
export const SECTION_INDEX_PROMPT = `你是一个文档解析助手。以下是文档的标题目录，请判断哪些章节可能包含 API 接口说明（endpoint、路由、接口路径等）。

排除明显无关的章节，如：许可证、更新日志、贡献指南、致谢、目录、前言。

返回一个 JSON 数组，包含相关章节的索引号。
只返回 JSON 数组，不要其他内容。

示例返回：[0, 2, 3]`;

/**
 * Phase 2：逐片提取 prompt。
 * 输入：单个 section 的完整内容
 * 输出：JSON 数组，每个元素是 PortfolioApiEndpoint
 */
export const API_EXTRACT_PROMPT = `你是一个文档解析助手。请从以下文档片段中提取 API 接口信息。

返回一个 JSON 数组，每个元素包含：
- method: HTTP 方法（GET/POST/PUT/DELETE/PATCH）
- path: 路径（如 /api/users/:id 或 /users）
- summary: 一句话描述
- description: 详细描述（可选）
- parameters: 参数数组（可选），每个参数包含 name, in(query/path/header/body), type, description, required

注意：
- 只提取明确的 API 接口信息
- 如果文档描述了多个端点，全部提取
- 路径中的参数用 :param 或 {param} 格式均可
- 如果此片段中没有 API 信息，返回 []

只返回 JSON 数组，不要其他内容。`;
