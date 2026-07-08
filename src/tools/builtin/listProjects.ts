/**
 * 列出所有作品集项目概览。
 */

import type { ToolDefinition } from '../types'

interface Project {
  name: string
  description: string
  techStack: string[]
  url?: string
  github?: string
  role?: string
  highlights?: string[]
}

interface ListProjectsParams {
  /** 按技术栈过滤（可选） */
  techFilter?: string
}

export const listProjectsTool: ToolDefinition<ListProjectsParams, Project[]> = {
  name: 'list_projects',
  description:
    '列出作品集中的所有项目概览。可按技术栈过滤。' +
    '返回项目名称、描述、技术栈、链接等。',
  inputSchema: {
    type: 'object',
    properties: {
      techFilter: {
        type: 'string',
        description: '按技术栈关键词过滤，如 "Vue", "React", "Node.js"',
      },
    },
  },
  async execute(ctx, params) {
    const response = await fetch(`${ctx.dataPath}/projects.json`)
    if (!response.ok) {
      throw new Error(`读取项目列表失败 (${response.status})`)
    }

    const projects: Project[] = await response.json()

    if (params.techFilter) {
      const keyword = params.techFilter.toLowerCase()
      return projects.filter((p) =>
        p.techStack.some((t) => t.toLowerCase().includes(keyword)),
      )
    }

    return projects
  },
}
