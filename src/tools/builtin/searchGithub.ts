/**
 * GitHub 仓库搜索。
 *
 * 通过 /api/github 代理转发，token 由代理层注入。
 */

import type { ToolDefinition } from '../types'

interface SearchGithubParams {
  /** 搜索关键词（可选，不传则列出用户所有仓库） */
  query?: string
  /** 排序方式 */
  sort?: 'stars' | 'updated' | 'forks'
  /** 返回数量限制 */
  limit?: number
}

interface GithubRepo {
  name: string
  full_name: string
  description: string | null
  html_url: string
  language: string | null
  stargazers_count: number
  forks_count: number
  topics: string[]
  updated_at: string
  pushed_at: string
}

export const searchGithubTool: ToolDefinition<SearchGithubParams, unknown> = {
  name: 'search_github',
  description:
    '搜索 GitHub 仓库。不传 query 则列出用户所有仓库。' +
    '返回仓库名称、描述、语言、星标数、链接等。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
      sort: {
        type: 'string',
        enum: ['stars', 'updated', 'forks'],
        description: '排序方式，默认 updated',
      },
      limit: {
        type: 'integer',
        description: '返回数量，默认 10，最大 30',
      },
    },
  },
  async execute(ctx, params) {
    const username = ctx.githubUsername
    if (!username) {
      throw new Error('未配置 GitHub 用户名（VITE_GITHUB_USERNAME）')
    }

    const limit = Math.min(params.limit ?? 10, 30)
    const sort = params.sort ?? 'updated'

    let url: string
    if (params.query) {
      // 搜索指定用户的仓库
      const q = `${params.query} user:${username}`
      url = `/api/github/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&per_page=${limit}`
    } else {
      // 列出用户所有仓库
      url = `/api/github/users/${username}/repos?sort=${sort}&per_page=${limit}`
    }

    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    })

    if (!response.ok) {
      throw new Error(`GitHub API 错误 (${response.status}): ${await response.text()}`)
    }

    const data = await response.json()

    // search 接口返回 { items: [...] }，users/repos 返回 [...]
    const repos: GithubRepo[] = Array.isArray(data) ? data : data.items ?? []

    return repos.map((repo) => ({
      name: repo.name,
      description: repo.description,
      url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      topics: repo.topics,
      updatedAt: repo.updated_at,
    }))
  },
}
