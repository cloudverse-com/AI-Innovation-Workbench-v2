import { useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, AppSettings } from '../types'
import { useSSE } from './useSSE'

interface UseChatOptions {
  demoId: string
  settings: AppSettings
}

// Demos that return streaming SSE
const STREAMING_DEMOS = new Set(['demo01', 'demo04', 'demo05', 'demo12', 'demo13'])

// Demos that return regular JSON (non-streaming)
const NON_STREAMING_DEMOS = new Set(['demo02', 'demo03'])

// Map demo ID → API endpoint
function getEndpoint(demoId: string): string {
  const map: Record<string, string> = {
    demo01: '/api/demo-01/chat/stream',
    demo02: '/api/demo-02/chat',
    demo03: '/api/demo-03/chat',
    demo04: '/api/demo-04/chat/stream',
    demo05: '/api/demo-05/chat/stream',
  }
  return map[demoId] ?? `/api/${demoId.replace('demo', 'demo-')}/chat/stream`
}

// Build a demo-specific request body
function buildRequestBody(
  demoId: string,
  message: string,
  settings: AppSettings,
  history: Array<{ role: string; content: string }>,
): Record<string, unknown> {
  const base = {
    model: settings.model,
    system_prompt: settings.systemPrompt.prompt,
  }
  return { ...base, message, history }
}

// Extract the text response from a non-streaming API response
function extractResponseText(data: Record<string, unknown>): string {
  if (typeof data.response === 'string') return data.response
  return JSON.stringify(data, null, 2)
}

export function useChat({ demoId, settings }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamingContentRef = useRef('')
  const streamingIdRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const addUserMessage = useCallback((content: string) => {
    const msg: ChatMessage = { id: uuidv4(), role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, msg])
    return msg
  }, [])

  const addAssistantMessage = useCallback((content: string, metadata?: Record<string, unknown>): ChatMessage => {
    const msg: ChatMessage = { id: uuidv4(), role: 'assistant', content, timestamp: new Date(), metadata }
    setMessages(prev => [...prev, msg])
    return msg
  }, [])

  const addStreamingMessage = useCallback((): string => {
    const id = uuidv4()
    const msg: ChatMessage = { id, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true }
    setMessages(prev => [...prev, msg])
    streamingContentRef.current = ''
    streamingIdRef.current = id
    setStreamingMessageId(id)
    return id
  }, [])

  const appendToken = useCallback((token: string, msgId: string) => {
    streamingContentRef.current += token
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, content: streamingContentRef.current } : m)
    )
  }, [])

  const appendToolCall = useCallback((tool: string, msgId: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId) return m
        const existing = m.toolsUsed ?? []
        if (existing.some(t => t.tool === tool)) return m   // dedupe
        return { ...m, toolsUsed: [...existing, { tool, args: {} }] }
      })
    )
  }, [])

  const finalizeMessage = useCallback((msgId: string, metadata?: Record<string, unknown>) => {
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, isStreaming: false, metadata } : m)
    )
    streamingIdRef.current = null
    setStreamingMessageId(null)
    setIsLoading(false)
  }, [])

  const { streamFromUrl } = useSSE({
    onToken: (token) => { if (streamingIdRef.current) appendToken(token, streamingIdRef.current) },
    onEvent: (event) => {
      const tool = event.tool_call
      if (typeof tool === 'string' && streamingIdRef.current) {
        appendToolCall(tool, streamingIdRef.current)
      }
    },
    onDone: (meta) => { if (streamingIdRef.current) finalizeMessage(streamingIdRef.current, meta) },
    onError: (err) => {
      setError(err)
      if (streamingIdRef.current) {
        setMessages(prev =>
          prev.map(m => m.id === streamingIdRef.current
            ? { ...m, content: m.content || `Error: ${err}`, isStreaming: false }
            : m
          )
        )
        streamingIdRef.current = null
        setStreamingMessageId(null)
      }
      setIsLoading(false)
    },
  })

  const buildHistory = () =>
    messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null)
      setIsLoading(true)
      addUserMessage(content)

      const history = buildHistory()
      const url = getEndpoint(demoId)
      const body = buildRequestBody(demoId, content, settings, history)

      // ── STREAMING DEMOS (SSE) ────────────────────────────────────────────
      if (STREAMING_DEMOS.has(demoId)) {
        addStreamingMessage()
        await streamFromUrl(url, body)
        return
      }

      // ── NON-STREAMING DEMOS (regular JSON fetch) ─────────────────────────
      if (NON_STREAMING_DEMOS.has(demoId)) {
        abortRef.current?.abort()
        abortRef.current = new AbortController()

        const loadingId = uuidv4()
        setMessages(prev => [...prev, {
          id: loadingId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true,
        }])
        setStreamingMessageId(loadingId)

        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: abortRef.current.signal,
          })

          if (!resp.ok) {
            const errText = await resp.text()
            throw new Error(`HTTP ${resp.status}: ${errText}`)
          }

          const data = await resp.json() as Record<string, unknown>
          const responseText = extractResponseText(data)

          setMessages(prev =>
            prev.map(m => m.id === loadingId
              ? { ...m, content: responseText, isStreaming: false, metadata: data }
              : m
            )
          )
          setStreamingMessageId(null)
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return
          const errMsg = err instanceof Error ? err.message : 'Request failed'
          setError(errMsg)
          setMessages(prev =>
            prev.map(m => m.id === loadingId
              ? { ...m, content: `Error: ${errMsg}`, isStreaming: false }
              : m
            )
          )
          setStreamingMessageId(null)
        } finally {
          setIsLoading(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demoId, settings, messages, streamFromUrl],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    abortRef.current?.abort()
    setStreamingMessageId(null)
    setIsLoading(false)
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
    if (streamingMessageId) {
      setMessages(prev =>
        prev.map(m => m.id === streamingMessageId ? { ...m, isStreaming: false } : m)
      )
      setStreamingMessageId(null)
    }
  }, [streamingMessageId])

  return { messages, isLoading, error, streamingMessageId, sendMessage, clearMessages, cancel }
}
