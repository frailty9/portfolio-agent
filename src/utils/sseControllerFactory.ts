/**
 * SSE 应用层控制器工厂
 *
 * 职责：
 * - 在 sseHelper 之上提供应用层抽象：累积 chunk、链式回调、stop 控制
 * - 通过 parseChunk 决定如何解析具体事件
 * - 内置处理 event: "done" 事件，自动关闭连接
 */

import { createSSEHelper, type SSEHelperOptions } from '@/utils/sseHelper'
import type { EventSourceMessage } from '@microsoft/fetch-event-source'

type AccumulatedType<T> = T extends string ? string : T[]

interface SseController<T> {
  onChunk: (cb: (chunk: T) => void) => SseController<T>
  onSnapshot: (cb: (fullText: AccumulatedType<T>) => void) => SseController<T>
  onDone: (cb: (fullText: AccumulatedType<T>) => void) => SseController<T>
  onError: (cb: (error: Error) => void) => SseController<T>
  stop: () => void
}

type ChunkParser<T> = (msg: EventSourceMessage) => T | null | undefined

const createSseController = <T>(
  relativeUrl: string,
  options: Omit<SSEHelperOptions, 'onMessage'>,
  parseChunk: ChunkParser<T>,
): SseController<T> => {
  const chunkCallbacks: Array<(chunk: T) => void> = []
  const snapshotCallbacks: Array<(fullText: AccumulatedType<T>) => void> = []
  const doneCallbacks: Array<(fullText: AccumulatedType<T>) => void> = []
  const errorCallbacks: Array<(error: Error) => void> = []

  let chunks: AccumulatedType<T> | undefined = undefined
  let isStopped = false

  const helper = createSSEHelper(relativeUrl, {
    ...options,
    onMessage(msg: EventSourceMessage) {
      if (isStopped) return

      if (msg.event === 'done') {
        doneCallbacks.forEach((cb) => cb(chunks!))
        helper.close()
        return
      }

      const chunk = parseChunk(msg)
      if (chunk) {
        chunkCallbacks.forEach((cb) => cb(chunk))
        if (typeof chunk === 'string') {
          if (chunks) {
            ;(chunks as string) += chunk
          } else {
            chunks = chunk as AccumulatedType<T>
          }
        } else {
          if (chunks) {
            ;(chunks as Array<T>).push(chunk)
          } else {
            chunks = [chunk] as AccumulatedType<T>
          }
        }
      }
      snapshotCallbacks.forEach((cb) => cb(chunks!))
    },

    onClose() {
      if (isStopped) return
      if (chunks) {
        doneCallbacks.forEach((cb) => cb(chunks!))
      }
      options.onClose?.()
    },

    onError(error: Error) {
      if (isStopped) return
      isStopped = true
      errorCallbacks.forEach((cb) => cb(error))
      options.onError?.(error)
    },
  })

  helper.start()

  return {
    onChunk(cb) {
      chunkCallbacks.push(cb)
      return this
    },
    onSnapshot(cb) {
      snapshotCallbacks.push(cb)
      return this
    },
    onDone(cb) {
      doneCallbacks.push(cb)
      return this
    },
    onError(cb) {
      errorCallbacks.push(cb)
      return this
    },
    stop() {
      if (isStopped) return
      isStopped = true
      helper.close()
      if (chunks) {
        doneCallbacks.forEach((cb) => cb(chunks!))
      }
    },
  }
}

export { createSseController }
export type { SseController }
