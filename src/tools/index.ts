/**
 * 工具入口：注册所有内置工具，提供查询接口。
 */

import { registerTool, findTool, getAllTools } from './registry';
import { searchGithubTool } from './builtin/searchGithub';
import { webFetchTool } from './builtin/webFetch';
import type { ToolSpec } from './types';

// 注册所有内置工具
registerTool(searchGithubTool);
registerTool(webFetchTool);

export { findTool, getAllTools };

/** 获取所有工具的 LLM 视图（不含 execute） */
export function getToolSpecs(): ToolSpec[] {
    return getAllTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
    }));
}
