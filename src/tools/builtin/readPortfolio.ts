/**
 * 读取作品集数据文件。
 *
 * 直接通过 fetch 读取 /portfolio-data/ 下的 JSON 文件。
 */

import type { ToolDefinition } from '../types'

interface ReadPortfolioParams {
  /** 文件名（不含路径和扩展名），如 "profile", "projects", "skills" */
  file: string
}

export const readPortfolioTool: ToolDefinition<ReadPortfolioParams, unknown> = {
  name: 'read_portfolio',
  description:
    '读取作品集数据文件。可读取 profile（个人简介）、projects（项目列表）、skills（技能栈）。' +
    '返回对应 JSON 数据。',
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: '文件名，如 "profile", "projects", "skills"',
        enum: ['profile', 'projects', 'skills'],
      },
    },
    required: ['file'],
  },
  async execute(ctx, params) {
    const allowedFiles = ['profile', 'projects', 'skills']
    if (!allowedFiles.includes(params.file)) {
      throw new Error(`不允许读取文件: ${params.file}。可选: ${allowedFiles.join(', ')}`)
    }

    const url = `${ctx.dataPath}/${params.file}.json`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`读取失败 (${response.status}): ${url}`)
    }
    return response.json()
  },
}
