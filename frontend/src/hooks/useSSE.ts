import { useCallback, useRef } from 'react'
import type { SSETokenEvent } from '../types'

interface UseSSEOptions {
  onToken: (token: string) => void
  onDone: (metadata?: Record<string, unknown>) => void
  onError: (error: string) => void
  onEvent?: (event: SSETokenEvent) => void
}

export function useSSE(options: UseSSEOptions) {
  const abortControllerRef = useRef<AbortController | null>(null)

  const streamFromUrl = useCallback(
    async (url: string, body: unknown) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          options.onError(`HTTP ${response.status}: ${errorText}`)
          return
        }

        if (!response.body) {
          options.onError('No response body for streaming')
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const chunk of lines) {
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim()
                if (!dataStr) continue

                try {
                  const event = JSON.parse(dataStr) as SSETokenEvent

                  if (event.error) {
                    options.onError(event.error as string)
                  } else if (event.token !== undefined) {
                    options.onToken(event.token as string)
                    options.onEvent?.(event)
                  } else if (event.done) {
                    const { done: _done, token: _token, ...metadata } = event
                    options.onDone(metadata)
                  } else {
                    options.onEvent?.(event)
                  }
                } catch {
                  // Non-JSON SSE data — ignore
                }
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        options.onError(err instanceof Error ? err.message : 'Stream error')
      }
    },
    [options],
  )

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  return { streamFromUrl, cancel }
}
