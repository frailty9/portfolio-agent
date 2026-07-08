/**
 * SSE 底层封装
 *
 * 职责：
 * - 对 @microsoft/fetch-event-source 进行二次封装
 * - 添加超时控制、连接状态管理
 * - 透传原始 EventSourceMessage 给上层
 */

import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source'

interface SSEHelperOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
  onMessage: (msg: EventSourceMessage) => void
  onOpen?: (response: Response) => void
  onClose?: () => void
  onError?: (error: Error) => void
}

interface SSEHelper {
  start: () => void
  close: () => void
  readonly readyState: 'connecting' | 'open' | 'closed'
}

const DEFAULT_TIMEOUT = 60000

const createSSEHelper = (
  url: string,
  options: SSEHelperOptions,
): SSEHelper => {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    onMessage,
    onOpen,
    onClose,
    onError,
  } = options

  let readyState: 'connecting' | 'open' | 'closed' = 'connecting'
  let timerId: ReturnType<typeof setTimeout> | null = null
  let isClosed = false
  const abortController = new AbortController()

  function clearTimer() {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  function handleClose() {
    if (isClosed) return
    isClosed = true
    clearTimer()
    onClose?.()
  }

  const helper: SSEHelper = {
    start() {
      if (isClosed) return

      timerId = setTimeout(() => {
        abortController.abort()
        const error = new Error('请求超时')
        onError?.(error)
      }, timeout)

      fetchEventSource(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body
          ? typeof body === 'object'
            ? JSON.stringify(body)
            : (body as string)
          : undefined,
        signal: abortController.signal,
        openWhenHidden: true,

        onmessage(msg: EventSourceMessage) {
          onMessage(msg)
        },

        onopen(response: Response): Promise<void> {
          readyState = 'open'
          onOpen?.(response)
          return Promise.resolve()
        },

        onclose() {
          handleClose()
        },

        onerror(error) {
          if (isClosed) return
          onError?.(error)
          throw error
        },
      })
    },

    close() {
      if (isClosed) return
      abortController.abort()
      handleClose()
    },

    get readyState() {
      if (isClosed) return 'closed'
      return readyState
    },
  }

  return helper
}

export { createSSEHelper }
export type { SSEHelper, SSEHelperOptions }
