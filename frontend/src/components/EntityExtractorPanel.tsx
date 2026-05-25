import React, { useCallback, useRef, useState } from 'react'
import type { Demo } from '../types'

interface EntityExtractorPanelProps {
  demo: Demo
}

interface Entities {
  raw_response?: string
  [key: string]: string[] | string | undefined
}

interface ExtractResult {
  entities?: Entities | null
  text_length?: number
  truncated?: boolean
  filename?: string
  model?: string
  error?: string
}

// Cycle through a palette of colors for dynamic categories
const CHIP_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-yellow-50 text-yellow-700 border-yellow-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-gray-50 text-gray-700 border-gray-200',
]

function formatLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function EntityCategory({
  label, color, items,
}: { label: string; color: string; items: string[] }) {
  return (
    <div className="border border-ms-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-ms-gray-50 border-b border-ms-gray-200 flex items-center gap-2">
        <span className="text-xs font-semibold text-ms-gray-500 uppercase tracking-wider">{label}</span>
        <span className="ml-auto text-xs text-ms-gray-400 font-mono">{items.length}</span>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function ResultDisplay({ data }: { data: ExtractResult }) {
  const [showRaw, setShowRaw] = useState(false)
  const entities = data.entities

  const dynamicCategories = entities
    ? Object.entries(entities).filter(([k, v]) => k !== 'raw_response' && Array.isArray(v)) as [string, string[]][]
    : []

  const totalCount = dynamicCategories.reduce((sum, [, v]) => sum + v.length, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-ms-gray-800">Extraction Complete</span>
          {data.filename && (
            <span className="text-xs text-ms-gray-400 font-mono bg-ms-gray-100 px-2 py-0.5 rounded">
              {data.filename}
            </span>
          )}
          {data.model && (
            <span className="text-xs text-ms-blue font-mono bg-ms-blue/10 px-2 py-0.5 rounded">
              {data.model}
            </span>
          )}
          <span className="text-xs text-ms-gray-500">
            {totalCount} {totalCount === 1 ? 'entity' : 'entities'} found
            {data.text_length != null && ` · ${(data.text_length / 1000).toFixed(1)}k chars`}
          </span>
        </div>
        <button
          onClick={() => setShowRaw(r => !r)}
          className="text-xs text-ms-gray-400 hover:text-ms-gray-600 px-2 py-1 rounded hover:bg-ms-gray-100 transition-colors flex-shrink-0"
        >
          {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
        </button>
      </div>

      {data.truncated && (
        <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>Document was truncated to 12 000 characters for LLM processing.</span>
        </div>
      )}

      {/* Raw response fallback */}
      {entities?.raw_response && (
        <div className="border border-ms-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-ms-gray-50 border-b border-ms-gray-200">
            <span className="text-xs font-semibold text-ms-gray-500 uppercase tracking-wider">LLM Response (unparsed)</span>
          </div>
          <pre className="px-4 py-3 text-sm text-ms-gray-700 whitespace-pre-wrap font-mono bg-white max-h-64 overflow-y-auto scrollbar-thin">
            {entities.raw_response}
          </pre>
        </div>
      )}

      {/* Entity categories — dynamically rendered from LLM response */}
      {entities && !entities.raw_response && (
        <>
          {dynamicCategories.map(([key, items], idx) => (
            <EntityCategory
              key={key}
              label={formatLabel(key)}
              color={CHIP_COLORS[idx % CHIP_COLORS.length]}
              items={items}
            />
          ))}
          {totalCount === 0 && (
            <div className="text-center py-6 text-ms-gray-400 text-sm">
              No entities were found in this document.
            </div>
          )}
        </>
      )}

      {/* Raw JSON toggle */}
      {showRaw && (
        <div className="border border-ms-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-ms-gray-800 border-b border-ms-gray-700">
            <span className="text-xs font-semibold text-ms-gray-300 uppercase tracking-wider">Raw JSON</span>
          </div>
          <pre className="px-4 py-3 text-xs text-green-400 bg-ms-gray-900 overflow-auto max-h-96 scrollbar-thin font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function EntityExtractorPanel({ demo }: EntityExtractorPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractResult | null>(null)
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

  const handleExtract = async () => {
    if (!file) return
    setIsLoading(true); setError(null); setResult(null); setProgress(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const resp = await fetch('/api/demo-08/extract', { method: 'POST', body: form })
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
          else if (event.status === 'analyzing') setProgress('Analyzing with LLM…')
          else if (event.done) { setResult(event); setProgress(null) }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Extraction failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null); setResult(null); setError(null); setProgress(null)
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
        {(file || result) && (
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

        {/* Extract button */}
        <button
          onClick={handleExtract}
          disabled={!file || isLoading}
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
              <span>🔍</span>
              Extract Entities
            </>
          )}
        </button>
      </div>

      {/* Scrollable results */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
        {!file && !result && !error && (
          <div className="text-center py-6 text-ms-gray-400 text-sm space-y-1">
            <p>Upload a PDF to extract named entities using the LLM.</p>
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

        {result && <ResultDisplay data={result} />}
      </div>
    </div>
  )
}
