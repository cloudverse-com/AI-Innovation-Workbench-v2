import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Demo } from '../types'

interface ContractComparisonPanelProps {
  demo: Demo
}

const ANALYZERS = [
  'Contract_Term_Review',
  'ContractComparisonFromCUTeam',
  'Contract_Term_Review_Babar_Analyzer',
]

// ── Data types ────────────────────────────────────────────────────────────────

interface ClauseAnalysis {
  category: string
  testContract: string
  referenceContract: string
  state: string
  testScopeList?: string[]
  referenceScopeList?: string[]
}

interface Recommendation {
  priority: 'HIGH PRIORITY' | 'MEDIUM PRIORITY' | 'LOW PRIORITY'
  text: string
}

interface ProcessedReport {
  summary: string
  presentCount: number
  totalCount: number
  conflicting: ClauseAnalysis[]
  missing: ClauseAnalysis[]
  scope: ClauseAnalysis[]
  recommendations: Recommendation[]
  analysisDate: string
  analyzerId?: string
}

// ── Data extraction helpers (ported from Angular TS) ──────────────────────────

function findValueString(
  obj: Record<string, Record<string, unknown>>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    if (obj[key]?.valueString) return String(obj[key].valueString)
    const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase())
    if (found && obj[found]?.valueString) return String(obj[found].valueString)
  }
}

function extractReferenceInfo(diff: string): string {
  const m = diff.match(/(?:The|In the) reference contract (.*?)(?:\. (?:The|In the|In contrast)|$)/i)
  if (m?.[1]) {
    const t = m[1].trim()
    return t.charAt(0).toUpperCase() + t.slice(1) + (t.endsWith('.') ? '' : '.')
  }
  return diff
}

function extractTestInfo(diff: string, state: string): string {
  if (state === 'Removed') return 'Clause absent from contract.'
  const m1 = diff.match(/(?:The|In the|In contrast, the) (?:completed|test|instance) contract (.*?)(?:\.|$)/i)
  if (m1?.[1]) {
    const t = m1[1].trim()
    return t.charAt(0).toUpperCase() + t.slice(1) + (t.endsWith('.') ? '' : '.')
  }
  const m2 = diff.match(/(?:The|This)(?:.*?) clause (.*?)(?:,?\s+(?:which|contrasting|diverging|but|however)|[;.]|$)/i)
  if (m2?.[1] && m2[1].trim().length > 5) {
    const t = m2[1].trim()
    return t.charAt(0).toUpperCase() + t.slice(1) + (t.endsWith('.') ? '' : '.')
  }
  return diff
}

const REC_MAP: { match: string; text: string; priority: Recommendation['priority'] }[] = [
  { match: 'compensation',        text: 'Add compensation terms with specific payment amounts and schedule',             priority: 'HIGH PRIORITY' },
  { match: 'intellectual',        text: 'Include intellectual property ownership clause',                                priority: 'HIGH PRIORITY' },
  { match: 'confidentiality',     text: 'Add confidentiality protection clause with 3-year survival period',            priority: 'HIGH PRIORITY' },
  { match: 'term duration',       text: 'Change term duration to align with reference contract',                         priority: 'HIGH PRIORITY' },
  { match: 'termination',         text: 'Remove restrictive termination clause and add 30-day cure period (industry standard)', priority: 'MEDIUM PRIORITY' },
  { match: 'insurance',           text: 'Increase insurance coverage to meet reference standard',                        priority: 'MEDIUM PRIORITY' },
  { match: 'liability',           text: 'Include liability limitation clause with cap on damages',                       priority: 'MEDIUM PRIORITY' },
  { match: 'dispute',             text: 'Add detailed dispute resolution process with arbitration',                      priority: 'MEDIUM PRIORITY' },
  { match: 'data security',       text: 'Add data security and privacy compliance clause',                               priority: 'LOW PRIORITY' },
  { match: 'data privacy',        text: 'Add data security and privacy compliance clause',                               priority: 'LOW PRIORITY' },
  { match: 'service description', text: 'Expand service scope to include specific deliverables',                         priority: 'LOW PRIORITY' },
  { match: 'scope',               text: 'Expand service scope to include specific deliverables',                         priority: 'LOW PRIORITY' },
]

function generateRecommendations(
  conflicting: ClauseAnalysis[],
  missing: ClauseAnalysis[],
  scope: ClauseAnalysis[],
): Recommendation[] {
  const recs: Recommendation[] = []
  const seen = new Set<string>()
  const add = (text: string, priority: Recommendation['priority']) => {
    if (!seen.has(text)) { seen.add(text); recs.push({ text, priority }) }
  }

  for (const clause of [...conflicting, ...missing, ...scope]) {
    const lower = clause.category.toLowerCase()
    const entry = REC_MAP.find(r => lower.includes(r.match))
    if (entry) add(entry.text, entry.priority)
    else if (clause.state === 'Removed') add(`Add missing "${clause.category}" clause`, 'HIGH PRIORITY')
    else add(`Review "${clause.category}" clause for compliance`, 'MEDIUM PRIORITY')
  }

  const order: Record<string, number> = { 'HIGH PRIORITY': 3, 'MEDIUM PRIORITY': 2, 'LOW PRIORITY': 1 }
  return recs.sort((a, b) => order[b.priority] - order[a.priority])
}

function processReportData(
  data: Record<string, unknown>,
  filename: string,
): ProcessedReport | null {
  const result = data.result as Record<string, unknown> | undefined
  if (!result) return null

  const contents = (result.contents ?? []) as Array<Record<string, unknown>>
  const analyzerId = result.analyzerId as string | undefined

  // Find clauses array anywhere in contents fields
  let clausesArray: unknown[] | null = null
  for (const content of contents) {
    const fields = content.fields as Record<string, Record<string, unknown>> | undefined
    if (!fields) continue
    for (const fv of Object.values(fields)) {
      if (fv?.type === 'array' && Array.isArray(fv.valueArray) && fv.valueArray.length > 0) {
        clausesArray = fv.valueArray
        break
      }
    }
    if (clausesArray) break
  }
  if (!clausesArray) return null

  const conflicting: ClauseAnalysis[] = []
  const missing: ClauseAnalysis[] = []
  const scope: ClauseAnalysis[] = []
  let presentCount = 0

  for (const clauseObj of clausesArray) {
    const clause = (clauseObj as Record<string, unknown>)?.valueObject as
      | Record<string, Record<string, unknown>>
      | undefined
    if (!clause) continue

    const heading =
      findValueString(clause, ['ClauseHeading', 'ArticleNumber', 'ClauseNumber', 'Heading', 'Title', 'Term', 'Category']) ?? 'Unknown Term'
    const state =
      findValueString(clause, ['State', 'Status', 'Condition']) ?? 'Unchanged'
    const diff =
      findValueString(clause, ['ComprehensiveListofDifferences', 'Differences', 'Analysis', 'Description']) ?? ''

    if (state !== 'Removed') presentCount++

    const analysis: ClauseAnalysis = {
      category: heading,
      testContract: extractTestInfo(diff, state),
      referenceContract: extractReferenceInfo(diff),
      state,
    }

    if (state === 'Removed') {
      missing.push(analysis)
    } else if (state === 'Edited') {
      const lower = heading.toLowerCase()
      if (lower.includes('service') || lower.includes('scope')) {
        const refPart = analysis.referenceContract
          .replace(/^(?:specifies|includes|provides) (?:that the consultant will provide services including|services including)/i, '')
          .replace(/\.$/, '')
        analysis.referenceScopeList = refPart.split(/,\s*|\s+and\s+/).map(s => s.trim()).filter(Boolean)
        const lm = analysis.testContract.match(/limits the services to (.*?)(?:, omitting|\.|$)/i)
        if (lm?.[1]) {
          analysis.testScopeList = lm[1].split(/,\s*|\s+and\s+/).map(s => s.trim()).filter(Boolean)
        }
        scope.push(analysis)
      } else {
        conflicting.push(analysis)
      }
    }
  }

  const total = clausesArray.length
  const summary =
    `This analysis compares the Test Contract (${filename || 'Instance Contract'}) against the Reference Contract to identify critical differences and missing provisions. The contract contains only ${presentCount} of ${total} standard terms.`

  return {
    summary,
    presentCount,
    totalCount: total,
    conflicting,
    missing,
    scope,
    recommendations: generateRecommendations(conflicting, missing, scope),
    analysisDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    analyzerId,
  }
}

function extractResultId(data: Record<string, unknown>): string | null {
  return (data.resultId as string) ?? (data.id as string) ?? (data.operationId as string) ?? null
}

// ── Report rendering components ───────────────────────────────────────────────

const BLUE = '#2F5597'
const RED  = '#C00000'
const LBLUE = '#4472C4'

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ color: BLUE }} className="text-lg font-bold mb-3 mt-1">
      {children}
    </h3>
  )
}

function ConflictingTable({ items, search }: { items: ClauseAnalysis[]; search: string }) {
  const rows = search
    ? items.filter(r => r.category.toLowerCase().includes(search) || r.testContract.toLowerCase().includes(search) || r.referenceContract.toLowerCase().includes(search))
    : items
  if (!rows.length) return <p className="text-sm text-gray-500">No conflicting terms found.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ border: '1px solid #bfbfbf' }}>
        <thead>
          <tr style={{ backgroundColor: BLUE }}>
            <th className="text-left px-3 py-2.5 text-white font-bold w-1/4" style={{ border: '1px solid #bfbfbf' }}>Term Category</th>
            <th className="text-left px-3 py-2.5 text-white font-bold w-2/5" style={{ border: '1px solid #bfbfbf' }}>Contract</th>
            <th className="text-left px-3 py-2.5 text-white font-bold" style={{ border: '1px solid #bfbfbf' }}>Reference Contract</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => (
            <tr key={i}>
              <td className="px-3 py-3 font-bold align-top" style={{ border: '1px solid #bfbfbf', backgroundColor: '#FFF2CC' }}>
                {item.category}
              </td>
              <td className="px-3 py-3 align-top leading-relaxed" style={{ border: '1px solid #bfbfbf', color: RED }}>
                {item.testContract}
              </td>
              <td className="px-3 py-3 align-top leading-relaxed text-gray-800" style={{ border: '1px solid #bfbfbf' }}>
                {item.referenceContract}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MissingTable({ items, search }: { items: ClauseAnalysis[]; search: string }) {
  const rows = search
    ? items.filter(r => r.category.toLowerCase().includes(search) || r.referenceContract.toLowerCase().includes(search))
    : items
  if (!rows.length) return <p className="text-sm text-gray-500">No missing terms found.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ border: '1px solid #bfbfbf' }}>
        <thead>
          <tr style={{ backgroundColor: RED }}>
            <th className="text-left px-3 py-2.5 text-white font-bold w-1/3" style={{ border: '1px solid #bfbfbf' }}>Missing Term</th>
            <th className="text-left px-3 py-2.5 text-white font-bold" style={{ border: '1px solid #bfbfbf' }}>Reference Contract Terms</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => (
            <tr key={i}>
              <td className="px-3 py-3 font-bold align-top" style={{ border: '1px solid #bfbfbf', backgroundColor: '#FCE4D6' }}>
                {item.category}
              </td>
              <td className="px-3 py-3 align-top leading-relaxed text-gray-800" style={{ border: '1px solid #bfbfbf' }}>
                {item.referenceContract}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScopeTable({ items, search }: { items: ClauseAnalysis[]; search: string }) {
  const rows = search
    ? items.filter(r => r.testContract.toLowerCase().includes(search) || r.referenceContract.toLowerCase().includes(search))
    : items
  if (!rows.length) return <p className="text-sm text-gray-500">No scope differences found.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ border: '1px solid #bfbfbf' }}>
        <thead>
          <tr style={{ backgroundColor: LBLUE }}>
            <th className="text-left px-3 py-2.5 text-white font-bold w-1/2" style={{ border: '1px solid #bfbfbf' }}>Contract Scope</th>
            <th className="text-left px-3 py-2.5 text-white font-bold" style={{ border: '1px solid #bfbfbf' }}>Reference Contract Scope</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => (
            <tr key={i}>
              <td className="px-3 py-3 align-top" style={{ border: '1px solid #bfbfbf' }}>
                {item.testScopeList?.length ? (
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {item.testScopeList.map((s, j) => <li key={j}>{s}</li>)}
                  </ul>
                ) : (
                  <span className="text-gray-700">{item.testContract}</span>
                )}
              </td>
              <td className="px-3 py-3 align-top" style={{ border: '1px solid #bfbfbf' }}>
                {item.referenceScopeList?.length ? (
                  <ul className="list-disc list-inside space-y-1">
                    {item.referenceScopeList.map((s, j) => {
                      const extra = item.testScopeList && !item.testScopeList.some(t => t.toLowerCase().includes(s.toLowerCase()))
                      return <li key={j} className={extra ? 'font-bold text-gray-900' : 'text-gray-700'}>{s}</li>
                    })}
                  </ul>
                ) : (
                  <span className="text-gray-700">{item.referenceContract}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecommendationsList({ items, search }: { items: Recommendation[]; search: string }) {
  const rows = search ? items.filter(r => r.text.toLowerCase().includes(search)) : items
  if (!rows.length) return <p className="text-sm text-gray-500">No recommendations.</p>
  return (
    <ul className="space-y-2">
      {rows.map((rec, i) => {
        const color =
          rec.priority === 'HIGH PRIORITY' ? RED :
          rec.priority === 'MEDIUM PRIORITY' ? '#ED7D31' :
          '#7F7F7F'
        return (
          <li key={i} className="text-sm leading-relaxed">
            <span style={{ color, fontWeight: 700 }}>{rec.priority}: </span>
            <span className="text-gray-800">{rec.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

function ReportView({
  report, filename, search, rawData,
}: {
  report: ProcessedReport
  filename: string
  search: string
  rawData: Record<string, unknown>
}) {
  const [showRaw, setShowRaw] = useState(false)
  const q = search.toLowerCase().trim()

  return (
    <div className="bg-white rounded-xl border border-ms-gray-200 shadow-sm overflow-hidden">
      {/* Report header */}
      <div className="px-8 pt-8 pb-4 border-b border-ms-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Contract Analysis Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          IT Consulting Services Agreement — {filename || 'Instance Contract'}
          {report.analyzerId && (
            <span className="ml-2 text-xs font-mono text-ms-blue bg-ms-blue/10 px-2 py-0.5 rounded">{report.analyzerId}</span>
          )}
        </p>
        <p className="text-sm font-semibold text-gray-800 mt-1">
          Analysis Date: {report.analysisDate}
        </p>
      </div>

      <div className="px-8 py-6 space-y-8">

        {/* Executive Summary */}
        <section>
          <SectionHeading>Executive Summary</SectionHeading>
          <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
        </section>

        {/* Key Findings */}
        <section>
          <SectionHeading>Key Findings</SectionHeading>
          <ul className="space-y-1.5 text-sm text-gray-700">
            {report.conflicting.length > 0 && (
              <li>• <strong>{report.conflicting.length} Conflicting Term{report.conflicting.length !== 1 ? 's' : ''}</strong> that differ from reference standards</li>
            )}
            {report.missing.length > 0 && (
              <li>• <strong>{report.missing.length} Missing Term{report.missing.length !== 1 ? 's' : ''}</strong> that should be included</li>
            )}
            {report.scope.length > 0 && (
              <li>• <strong>{report.scope.length} Reduced Scope</strong> with limited services compared to reference</li>
            )}
            {report.conflicting.length === 0 && report.missing.length === 0 && report.scope.length === 0 && (
              <li>• No significant deviations found</li>
            )}
          </ul>
        </section>

        {/* Section 1: Conflicting Terms */}
        {report.conflicting.length > 0 && (
          <section>
            <SectionHeading>Section 1: Conflicting Terms</SectionHeading>
            <p className="text-sm text-gray-600 mb-3">
              The following terms exist in both contracts but have significant differences that require review:
            </p>
            <ConflictingTable items={report.conflicting} search={q} />
          </section>
        )}

        {/* Section 2: Missing Critical Terms */}
        {report.missing.length > 0 && (
          <section>
            <SectionHeading>Section 2: Missing Critical Terms</SectionHeading>
            <p className="text-sm text-gray-600 mb-3">
              The following essential terms are completely absent from the test contract:
            </p>
            <MissingTable items={report.missing} search={q} />
          </section>
        )}

        {/* Section 3: Scope Differences */}
        {report.scope.length > 0 && (
          <section>
            <SectionHeading>Section 3: Scope Differences</SectionHeading>
            <p className="text-sm text-gray-600 mb-3">
              The test contract has a narrower scope of services compared to the reference:
            </p>
            <ScopeTable items={report.scope} search={q} />
          </section>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <section>
            <SectionHeading>Recommendations</SectionHeading>
            <RecommendationsList items={report.recommendations} search={q} />
          </section>
        )}

        {/* Raw JSON toggle */}
        <div className="pt-2 border-t border-ms-gray-100">
          <button
            onClick={() => setShowRaw(r => !r)}
            className="text-xs text-ms-gray-400 hover:text-ms-gray-600 px-2 py-1 rounded hover:bg-ms-gray-100 transition-colors"
          >
            {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
          </button>
          {showRaw && (
            <pre className="mt-3 px-4 py-3 text-xs text-green-400 bg-ms-gray-900 rounded-xl overflow-auto max-h-96 font-mono scrollbar-thin">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ContractComparisonPanel({ demo }: ContractComparisonPanelProps) {
  const [file, setFile]             = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [analyzer, setAnalyzer]     = useState(ANALYZERS[0])
  const [isLoading, setIsLoading]   = useState(false)
  const [rawResult, setRawResult]   = useState<Record<string, unknown> | null>(null)
  const [report, setReport]         = useState<ProcessedReport | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [search, setSearch]         = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/demo-07/config').then(r => r.json()).catch(() => null)
  }, [])

  const startTimer = () => {
    setElapsedSeconds(0)
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
  }
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }
  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    if (f.size > 20 * 1024 * 1024)   { setError('File exceeds 20 MB limit.'); return }
    setFile(f); setRawResult(null); setReport(null); setError(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }, [handleFile])

  const handleReset = () => {
    setFile(null); setRawResult(null); setReport(null); setError(null); setSearch('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const setResultData = (data: Record<string, unknown>, filename: string) => {
    setRawResult(data)
    const processed = processReportData(data, filename)
    setReport(processed)
  }

  const pollForResult = async (resultId: string, filename: string) => {
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise<void>(r => setTimeout(r, 3000))
      setStatusText(`Analyzing… (${i + 1}/${maxAttempts})`)
      try {
        const resp = await fetch(`/api/demo-07/result/${resultId}`)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json() as Record<string, unknown>
        const status = (data.status as string | undefined)?.toLowerCase()
        if (status === 'succeeded') { setResultData(data, filename); return }
        if (status === 'failed')    { throw new Error('Analysis failed on the server.') }
      } catch (err) {
        if (i === maxAttempts - 1) throw err
      }
    }
    throw new Error('Analysis timed out.')
  }

  const handleAnalyze = async () => {
    if (!file || !analyzer) return
    setIsLoading(true); setError(null); setRawResult(null); setReport(null); setSearch('')
    setStatusText('Uploading and starting analysis…')
    startTimer()
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('analyzer_name', analyzer)
      const resp = await fetch('/api/demo-07/upload-and-start-analyze', { method: 'POST', body: form })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(body.detail ?? `HTTP ${resp.status}`)
      }
      const data = await resp.json() as Record<string, unknown>
      const status = (data.status as string | undefined)?.toLowerCase()
      if (status === 'succeeded') {
        setResultData(data, file.name)
      } else {
        const resultId = extractResultId(data)
        if (resultId) {
          setStatusText('Analysis in progress — polling for results…')
          await pollForResult(resultId, file.name)
        } else {
          setResultData(data, file.name)
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during analysis.')
    } finally {
      setIsLoading(false); stopTimer(); setStatusText('')
    }
  }

  const canAnalyze = !!file && !!analyzer && !isLoading

  return (
    <div className="flex h-full overflow-hidden bg-ms-gray-50">

      {/* ── Left panel ───────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-ms-gray-200 flex flex-col p-6 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-ms-gray-900">Documents</h2>
          <p className="text-xs text-ms-gray-500 mt-1">
            Select analyzer and upload an instance contract to begin analysis.
          </p>
        </div>

        {/* Analyzer dropdown */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-ms-gray-700">Analyzer</label>
          <select
            value={analyzer}
            onChange={e => setAnalyzer(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-ms-gray-300 px-3 py-2 text-sm text-ms-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ANALYZERS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* File upload */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ms-gray-700">Instance Contract</label>
            {file && (
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => !isLoading && fileInputRef.current?.click()}
            className={`border-2 rounded-xl p-4 text-center transition-all ${
              isLoading   ? 'cursor-not-allowed opacity-60 border-dashed border-ms-gray-200 bg-ms-gray-50' :
              isDragging  ? 'border-ms-blue bg-ms-blue/5 cursor-pointer' :
              file        ? 'border-ms-blue bg-ms-blue/5 cursor-pointer' :
                            'border-dashed border-ms-gray-300 bg-ms-gray-50 hover:border-ms-blue hover:bg-ms-blue/5 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {file ? (
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); handleReset() }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-ms-gray-400 hover:bg-ms-gray-600 text-white rounded-full text-xs flex items-center justify-center"
                  title="Remove file"
                >×</button>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">📄</span>
                  <p className="text-xs font-semibold text-ms-gray-800 break-all leading-tight">{file.name}</p>
                  <p className="text-xs text-green-600 font-medium">• Ready for analysis</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-ms-gray-400">
                <svg className="w-8 h-8 text-ms-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs font-medium text-ms-gray-600">Click to upload contract</p>
                <p className="text-xs text-ms-gray-400">(.pdf supported)</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
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
          ) : 'Compare Contracts'}
        </button>
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-ms-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-ms-gray-900">Analysis Report</h2>
          <div className="flex items-center bg-ms-gray-100 rounded-lg px-3 py-1.5 gap-2 w-64">
            <svg className="w-4 h-4 text-ms-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search findings..."
              className="bg-transparent text-sm text-ms-gray-700 placeholder-ms-gray-400 outline-none flex-1"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-ms-gray-400 hover:text-ms-gray-600 text-base leading-none">×</button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">

          {/* Empty state */}
          {!rawResult && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center text-ms-gray-400 space-y-3">
              <div className="text-4xl">✨</div>
              <h3 className="text-lg font-semibold text-ms-gray-700">Ready to Analyze</h3>
              <p className="text-sm max-w-xs">
                Select an analyzer and upload the instance contract to let the AI identify risks and deviations.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {demo.highlights.map((h, i) => (
                  <span key={i} className="bg-ms-gray-100 text-ms-gray-500 text-xs px-2.5 py-1 rounded-full">{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <svg className="w-12 h-12 animate-spin text-ms-blue" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <h3 className="text-lg font-semibold text-ms-gray-800">Analyzing Contracts…</h3>
              <p className="text-sm text-ms-gray-500">
                {statusText || 'Comparing clauses, checking definitions, and identifying risks.'}
              </p>
              <div className="flex items-center gap-2 px-4 py-2 bg-ms-gray-200 rounded-full text-sm font-mono font-semibold text-ms-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatElapsed(elapsedSeconds)}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Result — processed report */}
          {rawResult && !isLoading && report && (
            <ReportView
              report={report}
              filename={file?.name ?? ''}
              search={search}
              rawData={rawResult}
            />
          )}

          {/* Result — fallback raw view when report parsing failed */}
          {rawResult && !isLoading && !report && (
            <div className="rounded-xl border border-ms-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-ms-gray-800">
                <h3 className="text-sm font-bold text-white">Raw API Response</h3>
                <p className="text-xs text-ms-gray-400 mt-0.5">Could not parse into report structure — showing raw data</p>
              </div>
              <pre className="px-4 py-3 text-xs text-green-400 bg-ms-gray-900 overflow-auto max-h-screen font-mono scrollbar-thin">
                {JSON.stringify(rawResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-ms-gray-200 bg-white text-right text-xs text-ms-gray-400">
          This app was developed by another user. It may be inaccurate or unsafe.{' '}
          <a href="#" className="text-ms-blue hover:underline">Report legal issue</a>
        </div>
      </div>
    </div>
  )
}
