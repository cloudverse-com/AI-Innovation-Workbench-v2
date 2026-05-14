import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Demo } from '../types'

interface ContentUnderstandingPanelProps {
  demo: Demo
}

interface AnalysisField {
  type: string
  valueString?: string
  valueNumber?: number
  valueDate?: string
  content?: string
  [key: string]: unknown
}

interface AnalysisContent {
  fields?: Record<string, AnalysisField>
  markdown?: string
  kind?: string
}

interface AnalysisResult {
  result?: {
    contents?: AnalysisContent[]
    analyzerId?: string
    warnings?: unknown[]
  }
  filename?: string
  analyzer_id?: string
}

// Well-known Azure Content Understanding analyzer IDs
const PRESET_ANALYZERS = [
  { id: 'prebuilt-read',                   label: 'prebuilt-read — General document reading' },
  { id: 'prebuilt-layout',                 label: 'prebuilt-layout — Layout & structure analysis' },
  { id: 'prebuilt-invoice',                label: 'prebuilt-invoice — Invoice extraction' },
  { id: 'prebuilt-receipt',                label: 'prebuilt-receipt — Receipt extraction' },
  { id: 'prebuilt-healthInsuranceCard.us', label: 'prebuilt-healthInsuranceCard.us — US health insurance cards' },
  { id: 'prebuilt-idDocument',             label: 'prebuilt-idDocument — Identity documents' },
]

function FieldsTable({ fields }: { fields: Record<string, AnalysisField> }) {
  const entries = Object.entries(fields).filter(([, v]) => v != null)
  if (entries.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-ms-gray-100">
            <th className="text-left px-3 py-2 text-ms-gray-600 font-semibold border-b border-ms-gray-200 w-1/3">Field</th>
            <th className="text-left px-3 py-2 text-ms-gray-600 font-semibold border-b border-ms-gray-200">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, val]) => {
            const display =
              val?.valueString ??
              val?.content ??
              (val?.valueNumber != null ? String(val.valueNumber) : null) ??
              val?.valueDate ??
              JSON.stringify(val)
            return (
              <tr key={key} className="border-b border-ms-gray-100 hover:bg-ms-gray-50">
                <td className="px-3 py-2 font-medium text-ms-blue font-mono text-xs">{key}</td>
                <td className="px-3 py-2 text-ms-gray-800 whitespace-pre-wrap break-words">{display}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ResultDisplay({ data }: { data: AnalysisResult }) {
  const [showRaw, setShowRaw] = useState(false)
  const contents = data.result?.contents ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-ms-gray-800">Analysis Complete</span>
          {data.filename && (
            <span className="text-xs text-ms-gray-400 font-mono bg-ms-gray-100 px-2 py-0.5 rounded">
              {data.filename}
            </span>
          )}
          {data.analyzer_id && (
            <span className="text-xs text-ms-blue font-mono bg-ms-blue/10 px-2 py-0.5 rounded">
              {data.analyzer_id}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowRaw(r => !r)}
          className="text-xs text-ms-gray-400 hover:text-ms-gray-600 px-2 py-1 rounded hover:bg-ms-gray-100 transition-colors flex-shrink-0"
        >
          {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
        </button>
      </div>

      {contents.map((content, idx) => (
        <div key={idx} className="border border-ms-gray-200 rounded-xl overflow-hidden">
          {content.fields && Object.keys(content.fields).length > 0 && (
            <div>
              <div className="px-4 py-2.5 bg-ms-gray-50 border-b border-ms-gray-200">
                <span className="text-xs font-semibold text-ms-gray-500 uppercase tracking-wider">Extracted Fields</span>
              </div>
              <FieldsTable fields={content.fields} />
            </div>
          )}
          {content.markdown && (
            <div>
              <div className="px-4 py-2.5 bg-ms-gray-50 border-b border-ms-gray-200">
                <span className="text-xs font-semibold text-ms-gray-500 uppercase tracking-wider">Document Content</span>
              </div>
              <div className="px-4 py-3 text-sm text-ms-gray-700 whitespace-pre-wrap font-mono bg-white max-h-64 overflow-y-auto scrollbar-thin">
                {content.markdown}
              </div>
            </div>
          )}
        </div>
      ))}

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

export function ContentUnderstandingPanel({ demo }: ContentUnderstandingPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [analyzerId, setAnalyzerId] = useState('')
  const [customAnalyzer, setCustomAnalyzer] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/demo-06/config')
      .then(r => r.json())
      .then((cfg: { default_analyzer_id: string }) => {
        const def = cfg.default_analyzer_id
        if (!def) return
        const inPresets = PRESET_ANALYZERS.some(p => p.id === def)
        if (!inPresets) {
          setIsCustom(true)
          setCustomAnalyzer(def)
        }
        setAnalyzerId(def)
      })
      .catch(() => {})
  }, [])

  const effectiveAnalyzerId = isCustom ? customAnalyzer.trim() : analyzerId

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('File exceeds 20 MB limit.'); return }
    setFile(f); setResult(null); setError(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [handleFile])

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === '__custom__') { setIsCustom(true); setAnalyzerId('__custom__') }
    else { setIsCustom(false); setAnalyzerId(val) }
  }

  const handleAnalyze = async () => {
    if (!file || !effectiveAnalyzerId) return
    setIsLoading(true); setError(null); setResult(null)
    const form = new FormData()
    form.append('file', file)
    form.append('analyzer_id', effectiveAnalyzerId)
    try {
      const resp = await fetch('/api/demo-06/analyze', { method: 'POST', body: form })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(body.detail ?? `HTTP ${resp.status}`)
      }
      setResult(await resp.json() as AnalysisResult)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null); setResult(null); setError(null)
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
          <button onClick={handleReset} className="text-xs text-ms-gray-400 hover:text-ms-gray-600 px-3 py-1.5 rounded-lg hover:bg-ms-gray-100 transition-colors">
            Reset
          </button>
        )}
      </div>

      {/* Controls — always visible, no scrolling needed */}
      <div className="flex-shrink-0 bg-white border-b border-ms-gray-200 px-6 py-4 space-y-4">
        {/* Analyzer dropdown */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-ms-gray-500 uppercase tracking-wider">
            Analyzer
          </label>
          <select
            value={isCustom ? '__custom__' : analyzerId}
            onChange={handleSelectChange}
            disabled={isLoading}
            className="w-full rounded-lg border border-ms-gray-300 px-3 py-2 text-sm text-ms-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent disabled:opacity-50"
          >
            <option value="" disabled>Select an analyzer…</option>
            {analyzerId && !PRESET_ANALYZERS.some(p => p.id === analyzerId) && !isCustom && (
              <option value={analyzerId}>{analyzerId} (server default)</option>
            )}
            {PRESET_ANALYZERS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="__custom__">Custom analyzer ID…</option>
          </select>
          {isCustom && (
            <input
              type="text"
              value={customAnalyzer}
              onChange={e => setCustomAnalyzer(e.target.value)}
              placeholder="e.g. patient_medical_report"
              disabled={isLoading}
              className="w-full rounded-lg border border-ms-gray-300 px-3 py-2 text-sm font-mono text-ms-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent disabled:opacity-50"
            />
          )}
        </div>

        {/* File drop zone */}
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
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
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

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={!file || !effectiveAnalyzerId || isLoading}
          className="w-full py-2.5 rounded-xl bg-ms-blue hover:bg-ms-blue-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing…
            </>
          ) : (
            <>
              <span>🔍</span>
              {effectiveAnalyzerId ? `Analyze with ${effectiveAnalyzerId}` : 'Select an analyzer above'}
            </>
          )}
        </button>
      </div>

      {/* Scrollable results area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
        {/* Demo info — only when nothing is happening */}
        {!file && !result && !error && (
          <div className="text-center py-6 text-ms-gray-400 text-sm space-y-1">
            <p>Upload a medical report PDF above to get started.</p>
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
