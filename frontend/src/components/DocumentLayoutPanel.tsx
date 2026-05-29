import React, { useCallback, useRef, useState } from 'react'
import type { Demo } from '../types'

interface DocumentLayoutPanelProps {
  demo: Demo
}

interface TextBlock {
  text: string
  x?: number
  y?: number
  width?: number
  height?: number
  font?: string
  size?: number
}

interface PageResult {
  page: number
  text: string
  blocks: TextBlock[]
  block_count: number
}

interface ParseResult {
  pages?: PageResult[]
  page_count?: number
  char_count?: number
  parse_ms?: number
  filename?: string
  truncated?: boolean
  summary?: string
  model?: string
  error?: string
}

type ActiveTab = 'text' | 'blocks'

function SpeedBadge({ ms }: { ms: number }) {
  const color = ms < 200 ? 'bg-green-100 text-green-700 border-green-300'
    : ms < 1000 ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
    : 'bg-red-100 text-red-700 border-red-300'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold border ${color}`}>
      ⚡ {ms}ms
    </span>
  )
}

function PageTextView({ pages }: { pages: PageResult[] }) {
  return (
    <div className="space-y-4">
      {pages.map(p => (
        <div key={p.page} className="border border-ms-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-ms-gray-50 border-b border-ms-gray-200 flex items-center gap-3">
            <span className="text-xs font-semibold text-ms-gray-500 uppercase tracking-wider">
              Page {p.page}
            </span>
            <span className="ml-auto text-xs text-ms-gray-400 font-mono">{p.block_count} blocks</span>
          </div>
          <pre className="px-4 py-3 text-sm text-ms-gray-800 whitespace-pre-wrap font-sans bg-white max-h-72 overflow-y-auto scrollbar-thin leading-relaxed">
            {p.text || p.blocks.map(b => b.text).join(' ') || '(no text on this page)'}
          </pre>
        </div>
      ))}
    </div>
  )
}

function BlocksView({ pages }: { pages: PageResult[] }) {
  const [expandedPage, setExpandedPage] = useState<number | null>(pages[0]?.page ?? null)

  return (
    <div className="space-y-3">
      <p className="text-xs text-ms-gray-400 italic">
        Bounding box coordinates (x, y, width, height) show where each text block sits on the page.
      </p>
      {pages.map(p => (
        <div key={p.page} className="border border-ms-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedPage(expandedPage === p.page ? null : p.page)}
            className="w-full px-4 py-2.5 bg-ms-gray-50 border-b border-ms-gray-200 flex items-center gap-3 hover:bg-ms-gray-100 transition-colors text-left"
          >
            <span className="text-xs font-semibold text-ms-gray-500 uppercase tracking-wider">
              Page {p.page}
            </span>
            <span className="ml-auto text-xs text-ms-gray-400 font-mono">{p.block_count} blocks</span>
            <svg
              className={`w-3 h-3 text-ms-gray-400 transition-transform ${expandedPage === p.page ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedPage === p.page && (
            <div className="divide-y divide-ms-gray-100 max-h-80 overflow-y-auto scrollbar-thin bg-white">
              {p.blocks.length === 0 && (
                <div className="px-4 py-3 text-xs text-ms-gray-400 italic">No block data available for this page.</div>
              )}
              {p.blocks.map((block, i) => (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                  <span className="text-xs font-mono text-ms-gray-300 flex-shrink-0 w-6 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ms-gray-800 truncate">{block.text || '—'}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {block.x !== undefined && (
                        <span className="text-[10px] font-mono text-ms-gray-400">
                          x:{block.x} y:{block.y} w:{block.width} h:{block.height}
                        </span>
                      )}
                      {block.font && (
                        <span className="text-[10px] font-mono text-purple-400">{block.font} {block.size}pt</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SummaryView({ summary }: { summary: string }) {
  return (
    <div className="border border-ms-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-ms-blue/10 border-b border-ms-blue/20 flex items-center gap-2">
        <span>🤖</span>
        <span className="text-xs font-semibold text-ms-blue uppercase tracking-wider">AI Summary</span>
      </div>
      <div className="px-4 py-3 text-sm text-ms-gray-800 whitespace-pre-wrap leading-relaxed bg-white max-h-96 overflow-y-auto scrollbar-thin">
        {summary}
      </div>
    </div>
  )
}

export function DocumentLayoutPanel({ demo }: DocumentLayoutPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [streamingSummary, setStreamingSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('text')
  const [summarize, setSummarize] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('File exceeds 20 MB limit.'); return }
    setFile(f); setResult(null); setError(null); setStreamingSummary('')
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [handleFile])

  const handleParse = async () => {
    if (!file) return
    setIsLoading(true); setError(null); setResult(null); setProgress(null); setStreamingSummary('')

    const form = new FormData()
    form.append('file', file)
    form.append('summarize', summarize ? 'true' : 'false')

    try {
      const resp = await fetch('/api/demo-10/parse', { method: 'POST', body: form })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(body.detail ?? `HTTP ${resp.status}`)
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let parsedResult: ParseResult = {}

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

          if (event.status === 'parsing') {
            setProgress('Parsing PDF with LiteParse…')
          } else if (event.status === 'parsed') {
            parsedResult = {
              pages: event.pages,
              page_count: event.page_count,
              char_count: event.char_count,
              parse_ms: event.parse_ms,
              filename: event.filename,
              truncated: event.truncated,
            }
            setResult({ ...parsedResult })
            setProgress(null)
          } else if (event.status === 'summarizing') {
            setProgress('Generating AI summary…')
          } else if (event.token) {
            setStreamingSummary(prev => prev + event.token)
          } else if (event.done) {
            setResult({
              ...parsedResult,
              summary: event.summary,
              model: event.model,
            })
            setStreamingSummary('')
            setProgress(null)
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Parsing failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null); setResult(null); setError(null); setProgress(null); setStreamingSummary('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const hasSummary = !!(result?.summary || streamingSummary)

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
      <div className="flex-shrink-0 bg-white border-b border-ms-gray-200 px-6 py-4 space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging ? 'border-ms-blue bg-ms-blue/5'
            : file ? 'border-green-400 bg-green-50'
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

        {/* Summarize toggle */}
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={summarize}
            onChange={e => setSummarize(e.target.checked)}
            className="w-4 h-4 accent-ms-blue"
          />
          <span className="text-xs text-ms-gray-600">Also generate an AI summary after parsing</span>
        </label>

        {/* Parse button */}
        <button
          onClick={handleParse}
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
              <span>🗺️</span>
              Parse Layout
            </>
          )}
        </button>
      </div>

      {/* Scrollable results */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
        {/* Empty state */}
        {!file && !result && !error && (
          <div className="text-center py-6 text-ms-gray-400 text-sm space-y-1">
            <p>Upload a PDF to parse its layout with LiteParse.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-3">
              {demo.highlights.map((h, i) => (
                <span key={i} className="bg-ms-gray-100 text-ms-gray-500 text-xs px-2.5 py-1 rounded-full">{h}</span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result?.pages && (
          <>
            {/* Stats bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-ms-gray-800">Parsed Successfully</span>
              {result.filename && (
                <span className="text-xs text-ms-gray-400 font-mono bg-ms-gray-100 px-2 py-0.5 rounded">
                  {result.filename}
                </span>
              )}
              <span className="text-xs text-ms-gray-500">
                {result.page_count} {result.page_count === 1 ? 'page' : 'pages'}
                {result.char_count != null && ` · ${(result.char_count / 1000).toFixed(1)}k chars`}
              </span>
              {result.parse_ms != null && <SpeedBadge ms={result.parse_ms} />}
              {result.model && (
                <span className="text-xs text-ms-blue font-mono bg-ms-blue/10 px-2 py-0.5 rounded">
                  {result.model}
                </span>
              )}
            </div>

            {result.truncated && (
              <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>Document exceeds 12 000 characters — LLM summary uses truncated text.</span>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex border-b border-ms-gray-200 gap-1">
              {([
                { id: 'text', label: '📝 Structured Text' },
                { id: 'blocks', label: '📐 Layout Blocks' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'text-ms-blue border-ms-blue bg-ms-blue/5'
                      : 'text-ms-gray-500 border-transparent hover:text-ms-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'text' && <PageTextView pages={result.pages} />}
            {activeTab === 'blocks' && <BlocksView pages={result.pages} />}

            {/* Streaming summary */}
            {streamingSummary && (
              <div className="border border-ms-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-ms-blue/10 border-b border-ms-blue/20 flex items-center gap-2">
                  <span>🤖</span>
                  <span className="text-xs font-semibold text-ms-blue uppercase tracking-wider">AI Summary</span>
                  <svg className="w-3 h-3 ml-1 animate-spin text-ms-blue" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div className="px-4 py-3 text-sm text-ms-gray-800 whitespace-pre-wrap leading-relaxed bg-white max-h-96 overflow-y-auto scrollbar-thin">
                  {streamingSummary}
                </div>
              </div>
            )}

            {hasSummary && result.summary && !streamingSummary && (
              <SummaryView summary={result.summary} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
