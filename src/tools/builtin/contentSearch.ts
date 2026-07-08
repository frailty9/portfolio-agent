/**
 * 作品集内容搜索。
 *
 * 在 portfolio-data JSON 中搜索关键词。
 */

import type { ToolDefinition } from '../types'

interface ContentSearchParams {
  /** 搜索关键词 */
  keyword: string
  /** 指定搜索的文件（可选） */
  file?: string
}

interface SearchMatch {
  file: string
  field: string
  value: string
  matched: string
}

export const contentSearchTool: ToolDefinition<ContentSearchParams, SearchMatch[]> = {
  name: 'content_search',
  description:
    '在作品集数据中搜索关键词。搜索所有 JSON 文件的文本字段。' +
    '返回匹配的文件名、字段名和匹配内容。',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '搜索关键词（不区分大小写）',
      },
      file: {
        type: 'string',
        description: '限制搜索范围到指定文件，如 "projects", "skills"',
      },
    },
    required: ['keyword'],
  },
  async execute(ctx, params) {
    const files = params.file
      ? [params.file]
      : ['profile', 'projects', 'skills']

    const matches: SearchMatch[] = []
    const keyword = params.keyword.toLowerCase()

    for (const fileName of files) {
      const url = `${ctx.dataPath}/${fileName}.json`
      try {
        const response = await fetch(url)
        if (!response.ok) continue
        const data = await response.json()
        searchInValue(data, fileName, '', keyword, matches)
      } catch {
        // 跳过读取失败的文件
      }
    }

    return matches.slice(0, 50) // 限制返回数量
  },
}

function searchInValue(
  value: unknown,
  file: string,
  fieldPath: string,
  keyword: string,
  matches: SearchMatch[],
): void {
  if (typeof value === 'string') {
    if (value.toLowerCase().includes(keyword)) {
      matches.push({
        file,
        field: fieldPath,
        value: value.length > 200 ? value.slice(0, 200) + '...' : value,
        matched: keyword,
      })
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      searchInValue(item, file, `${fieldPath}[${i}]`, keyword, matches)
    })
  } else if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const path = fieldPath ? `${fieldPath}.${key}` : key
      searchInValue(val, file, path, keyword, matches)
    }
  }
}
