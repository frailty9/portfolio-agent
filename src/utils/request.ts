/**
 * HTTP 请求封装
 *
 * 职责：
 * - 统一的请求/响应/错误处理
 * - 自动序列化 JSON
 */

const DEFAULT_TIMEOUT = 10000

class HttpError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

interface RequestOptions<T = unknown> extends Omit<RequestInit, 'body' | 'headers'> {
  params?: Record<string, string | number>
  body?: T
  timeout?: number
  headers?: Record<string, string>
}

const request = async <R = unknown, T = unknown>(
  url: string,
  options: RequestOptions<T> = {},
): Promise<R> => {
  const {
    params,
    body,
    timeout = DEFAULT_TIMEOUT,
    headers = {},
    ...restOptions
  } = options

  let fullUrl = url
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value))
    })
    fullUrl += `?${searchParams.toString()}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  const fetchOptions: RequestInit = {
    ...restOptions,
    signal: controller.signal,
    headers: {
      ...headers,
    },
  }

  if (body && typeof body === 'object') {
    fetchOptions.body = JSON.stringify(body)
    if (!(fetchOptions.headers as Record<string, string>)['Content-Type']) {
      ;(fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json'
    }
  }

  try {
    const response = await fetch(fullUrl, fetchOptions)
    clearTimeout(timer)

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = null
      }
      throw new HttpError(
        (errorData as { error?: { message?: string } })?.error?.message || '请求失败',
        response.status,
        errorData,
      )
    }

    return (await response.json()) as R
  } catch (error: unknown) {
    clearTimeout(timer)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError('请求超时', 504)
    }
    if (error instanceof HttpError) throw error
    throw new HttpError(
      error instanceof Error ? error.message : '网络异常',
      0,
    )
  }
}

const server = {
  get: <T = unknown>(url: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>(url, { ...options, method: 'GET' }),

  post: <T = unknown, D = unknown>(url: string, data?: D, options?: RequestOptions<D>) =>
    request<T>(url, { ...options, body: data, method: 'POST' }),
}

export { HttpError, server }
