import React, { useCallback, useRef, useState } from 'react'
import type { Demo } from '../types'

interface InMemoryRAGPanelProps {
  demo: Demo
}

interface IndexedSession {
  sessionId: string
  filename: string
  chunkCount: number
  charCount: number
}

interface QAEntry {
  question: string
  answer: string
  chunksUsed: number
}

// ── Phase 1: Upload & Index ───────────────────────────────────────────────────

interface UploadPhaseProps {
  demo: Demo
  onIndexed: (session: IndexedSession) => void
}

function UploadPhase({ demo, onIndexed }: UploadPhaseProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('File exceeds 20 MB limit.'); return }
    setFile(f); setError(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [handleFile])

  const handleIndex = async () => {
    if (!file) return
    setIsIndexing(true); setError(null); setProgress(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const resp = await fetch('/api/demo-11/index', { method: 'POST', body: form })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(body.detail ?? `HTTP ${resp.status}`)
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const event = JSON.parse(line.slice(6))
          if (event.error) throw new Error(event.error)
          if (event.status === 'extracting') setProgress(event.message)
          if (event.done) {
            onIndexed({
              sessionId: event.session_id,
              filename: event.filename,
              chunkCount: event.chunk_count,
              charCount: event.char_count,
            })
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Indexing failed.')
    } finally {
      setIsIndexing(false)
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-ms-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-ms-gray-200 flex-shrink-0">
        <span className="text-xl">{demo.icon}</span>
        <div>
          <h2 className="font-semibold text-ms-gray-900">{demo.title}</h2>
          <p className="text-xs text-ms-gray-500">{demo.subtitle}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 bg-white border-b border-ms-gray-200 px-6 py-4 space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-ms-blue bg-ms-blue/5'
              : file
              ? 'border-green-400 bg-green-50'
              : 'border-ms-gray-300 bg-ms-gray-50 hover:border-ms-blue hover:bg-ms-blue/5'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="text-left">
                <p className="font-medium text-ms-gray-800 text-sm">{file.name}</p>
                <p className="text-xs text-ms-gray-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 text-ms-gray-400">
              <span className="text-2xl">⬆️</span>
              <div className="text-left">
                <p className="font-medium text-ms-gray-600 text-sm">Drop a PDF here or click to browse</p>
                <p className="text-xs">PDF only · max 20 MB</p>
              </div>
            </div>
          )}
        </div>

        {/* Index button */}
        <button
          onClick={handleIndex}
          disabled={!file || isIndexing}
          className="w-full py-2.5 rounded-xl bg-ms-blue hover:bg-ms-blue-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {isIndexing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {progress ?? 'Indexing…'}
            </>
          ) : (
            <>
              <span>🧩</span>
              Index Document
            </>
          )}
        </button>
      </div>

      {/* Empty state / error */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <span className="flex-shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {!file && !error && (
          <div className="text-center py-6 text-ms-gray-400 text-sm space-y-2">
            <p className="text-ms-gray-500">Upload a PDF to chunk and index it in memory, then ask multiple questions.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {demo.highlights.map((h, i) => (
                <span key={i} className="bg-ms-gray-100 text-ms-gray-500 text-xs px-2.5 py-1 rounded-full">{h}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Phase 2: Q&A ──────────────────────────────────────────────────────────────

interface QAPhaseProps {
  session: IndexedSession
  onReset: () => void
}

function QAPhase({ session, onReset }: QAPhaseProps) {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<QAEntry[]>([])
  const [streamed, setStreamed] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleAsk = async () => {
    const q = question.trim()
    if (!q || isLoading) return
    setQuestion('')
    setIsLoading(true); setError(null); setStreamed(''); setProgress(null)

    const form = new FormData()
    form.append('session_id', session.sessionId)
    form.append('question', q)

    try {
      const resp = await fetch('/api/demo-11/ask', { method: 'POST', body: form })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(body.detail ?? `HTTP ${resp.status}`)
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let chunksUsed = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const event = JSON.parse(line.slice(6))
          if (event.error) throw new Error(event.error)
          if (event.status === 'searching') setProgress('Searching chunks…')
          else if (event.status === 'generating') {
            chunksUsed = event.chunks_used ?? 0
            setProgress('Generating answer…')
          } else if (event.token) {
            setStreamed(s => s + event.token)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          } else if (event.done) {
            setHistory(h => [...h, { question: q, answer: event.response, chunksUsed: event.chunks_used ?? chunksUsed }])
            setStreamed('')
            setProgress(null)
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() }
  }

  return (
    <div className="flex flex-col h-full bg-ms-gray-50">
      {/* Header with session info */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-ms-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ms-gray-800 truncate">{session.filename}</p>
            <p className="text-xs text-ms-gray-500">
              {session.chunkCount} chunks · {(session.charCount / 1000).toFixed(1)}k chars indexed
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-ms-gray-400 hover:text-ms-gray-600 px-3 py-1.5 rounded-lg hover:bg-ms-gray-100 transition-colors flex-shrink-0"
        >
          New PDF
        </button>
      </div>

      {/* Conversation history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {history.length === 0 && !isLoading && (
          <div className="text-center py-8 text-ms-gray-400 text-sm">
            <p>Document indexed! Ask your first question below.</p>
          </div>
        )}

        {history.map((entry, i) => (
          <div key={i} className="space-y-2">
            {/* Question bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-ms-blue text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
                {entry.question}
              </div>
            </div>

            {/* Answer bubble */}
            <div className="flex justify-start">
              <div className="max-w-[85%] space-y-1.5">
                <div className="bg-white border border-ms-gray-200 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-ms-gray-800 leading-relaxed whitespace-pre-wrap">
                  {entry.answer}
                </div>
                <p className="text-xs text-ms-gray-400 pl-1">
                  {entry.chunksUsed} chunk{entry.chunksUsed !== 1 ? 's' : ''} retrieved
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Streaming answer */}
        {isLoading && (
          <div className="space-y-2">
            {progress && !streamed && (
              <div className="flex justify-start">
                <div className="bg-white border border-ms-gray-200 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-ms-gray-400 italic">
                  {progress}
                </div>
              </div>
            )}
            {streamed && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-white border border-ms-blue/30 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-ms-gray-800 leading-relaxed whitespace-pre-wrap">
                  {streamed}
                  <span className="inline-block w-1.5 h-4 bg-ms-blue ml-0.5 animate-pulse rounded-sm align-text-bottom" />
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <span className="flex-shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 bg-white border-t border-ms-gray-200 px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-xl border border-ms-gray-300 text-sm text-ms-gray-800 placeholder-ms-gray-400 focus:outline-none focus:border-ms-blue focus:ring-1 focus:ring-ms-blue resize-none disabled:opacity-50"
          />
          <button
            onClick={handleAsk}
            disabled={!question.trim() || isLoading}
            className="px-4 py-2 rounded-xl bg-ms-blue hover:bg-ms-blue-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex-shrink-0 self-end"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Ask'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export function InMemoryRAGPanel({ demo }: InMemoryRAGPanelProps) {
  const [session, setSession] = useState<IndexedSession | null>(null)

  if (!session) {
    return <UploadPhase demo={demo} onIndexed={setSession} />
  }

  return <QAPhase session={session} onReset={() => setSession(null)} />
}
