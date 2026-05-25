import React, { useCallback, useRef, useState } from 'react'
import type { Demo } from '../types'

interface DocumentAgentPanelProps {
  demo: Demo
}

interface AgentResult {
  response: string
  text_length?: number
  truncated?: boolean
  filename?: string
  agent_name?: string
}

function ResultDisplay({ data }: { data: AgentResult }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-ms-gray-800">Agent Response</span>
        {data.filename && (
          <span className="text-xs text-ms-gray-400 font-mono bg-ms-gray-100 px-2 py-0.5 rounded">
            {data.filename}
          </span>
        )}
        {data.agent_name && (
          <span className="text-xs text-ms-blue font-mono bg-ms-blue/10 px-2 py-0.5 rounded">
            {data.agent_name}
          </span>
        )}
        {data.text_length != null && (
          <span className="text-xs text-ms-gray-500">
            {(data.text_length / 1000).toFixed(1)}k chars extracted
          </span>
        )}
      </div>

      {data.truncated && (
        <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>Document was truncated to 12 000 characters before being sent to the agent.</span>
        </div>
      )}

      <div className="border border-ms-gray-200 rounded-xl overflow-hidden bg-white">
        <pre className="px-4 py-3 text-sm text-ms-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
          {data.response}
        </pre>
      </div>
    </div>
  )
}

export function DocumentAgentPanel({ demo }: DocumentAgentPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [streamed, setStreamed] = useState('')
  const [result, setResult] = useState<AgentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('File exceeds 20 MB limit.'); return }
    setFile(f); setResult(null); setError(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [handleFile])

  const handleSend = async () => {
    if (!file || !question.trim()) return
    setIsLoading(true); setError(null); setResult(null); setProgress(null); setStreamed('')

    const form = new FormData()
    form.append('file', file)
    form.append('question', question)

    try {
      const resp = await fetch('/api/demo-09/chat', { method: 'POST', body: form })
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
          if (event.status === 'parsing') setProgress('Parsing PDF…')
          else if (event.status === 'analyzing') setProgress('Asking the agent…')
          else if (event.token) setStreamed(s => s + event.token)
          else if (event.done) { setResult(event); setProgress(null) }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null); setQuestion(''); setResult(null); setError(null); setProgress(null); setStreamed('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col h-full bg-ms-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-ms-gray-200 flex-shrink-0">
        <div>
          <h2 className="font-semibold text-ms-gray-900 flex items-center gap-2">
            <span>{demo.icon}</span>
            <span>{demo.title}</span>
          </h2>
          <p className="text-xs text-ms-gray-500">{demo.subtitle}</p>
        </div>
        {(file || result || question) && (
          <button
            onClick={handleReset}
            className="text-xs text-ms-gray-400 hover:text-ms-gray-600 px-3 py-1.5 rounded-lg hover:bg-ms-gray-100 transition-colors"
          >
            Reset
          </button>
        )}
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

        {/* Question input */}
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question about the document…"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-ms-gray-300 text-sm text-ms-gray-800 placeholder-ms-gray-400 focus:outline-none focus:border-ms-blue focus:ring-1 focus:ring-ms-blue resize-none"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!file || !question.trim() || isLoading}
          className="w-full py-2.5 rounded-xl bg-ms-blue hover:bg-ms-blue-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {progress ?? 'Starting…'}
            </>
          ) : (
            <>
              <span>💬</span>
              Ask the Agent
            </>
          )}
        </button>
      </div>

      {/* Scrollable results */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
        {!file && !result && !error && !streamed && (
          <div className="text-center py-6 text-ms-gray-400 text-sm space-y-1">
            <p>Attach a PDF and ask a question — its text is extracted and sent to a hosted Foundry agent.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-3">
              {demo.highlights.map((h, i) => (
                <span key={i} className="bg-ms-gray-100 text-ms-gray-500 text-xs px-2.5 py-1 rounded-full">{h}</span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Live stream before completion */}
        {isLoading && streamed && (
          <div className="border border-ms-gray-200 rounded-xl overflow-hidden bg-white">
            <pre className="px-4 py-3 text-sm text-ms-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
              {streamed}
            </pre>
          </div>
        )}

        {result && <ResultDisplay data={result} />}
      </div>
    </div>
  )
}
