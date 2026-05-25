import React, { useEffect, useRef, useState } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'

interface CodePanelProps {
  demoId: string
}

const FILE_TABS: Record<string, Array<{ label: string; fileId: string }>> = {
  demo01: [{ label: 'demo01_foundry_chat_service.py', fileId: 'demo01' }],
  demo02: [{ label: 'demo02_foundry_agent_service.py', fileId: 'demo02' }],
  demo03: [{ label: 'api.py', fileId: 'demo03' }],
  demo04: [{ label: 'api.py', fileId: 'demo04' }],
  demo05: [{ label: 'api.py', fileId: 'demo05' }],
  demo07: [{ label: 'demo07_contract_comparison_service.py', fileId: 'demo07' }],
  demo08: [{ label: 'demo08_entity_extractor_service.py', fileId: 'demo08' }],
  demo09: [{ label: 'demo09_document_agent_service.py', fileId: 'demo09' }],
}

export function CodePanel({ demoId }: CodePanelProps) {
  const tabs = FILE_TABS[demoId] ?? [{ label: `${demoId}.py`, fileId: demoId }]
  const [activeTab, setActiveTab] = useState(0)
  const [code, setCode] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  const activeFileId = tabs[activeTab]?.fileId ?? demoId

  // Fetch code when tab changes
  useEffect(() => {
    if (code[activeFileId]) return   // Already cached

    setLoading(true)
    setError(null)

    fetch(`/api/code/${activeFileId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then(text => {
        setCode(prev => ({ ...prev, [activeFileId]: text }))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [activeFileId, code])

  // Apply Prism.js syntax highlighting after content loads
  useEffect(() => {
    if (codeRef.current && code[activeFileId]) {
      Prism.highlightElement(codeRef.current)
    }
  }, [code, activeFileId])

  // Reset tab when demo changes
  useEffect(() => {
    setActiveTab(0)
  }, [demoId])

  const handleCopy = () => {
    const content = code[activeFileId]
    if (!content) return
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const lineCount = (code[activeFileId] ?? '').split('\n').length

  return (
    <div className="flex flex-col h-full bg-ms-gray-900 code-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-ms-gray-800 border-b border-ms-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-ms-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span className="text-xs font-semibold text-ms-gray-300 uppercase tracking-wider">Source Code</span>
        </div>
        <div className="flex items-center gap-2">
          {code[activeFileId] && (
            <span className="text-xs text-ms-gray-500">{lineCount} lines</span>
          )}
          <button
            onClick={handleCopy}
            disabled={!code[activeFileId]}
            className="text-xs px-2 py-1 rounded bg-ms-gray-700 hover:bg-ms-gray-600 text-ms-gray-300 hover:text-white transition-colors disabled:opacity-40"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* File tabs */}
      {tabs.length > 1 && (
        <div className="flex overflow-x-auto scrollbar-thin bg-ms-gray-800 border-b border-ms-gray-700">
          {tabs.map((tab, i) => (
            <button
              key={tab.fileId}
              onClick={() => setActiveTab(i)}
              className={`flex-shrink-0 px-4 py-2 text-xs font-mono transition-colors border-b-2 ${
                activeTab === i
                  ? 'border-ms-blue text-white bg-ms-gray-900'
                  : 'border-transparent text-ms-gray-400 hover:text-ms-gray-200 hover:bg-ms-gray-750'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Code content */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {loading && (
          <div className="flex items-center justify-center h-full text-ms-gray-500 text-sm gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading source code...
          </div>
        )}

        {error && (
          <div className="p-6 text-sm text-red-400">
            <div className="font-semibold mb-1">Failed to load source code</div>
            <div className="font-mono text-xs text-ms-gray-500">{error}</div>
          </div>
        )}

        {!loading && !error && code[activeFileId] && (
          <div className="relative">
            {/* Line numbers */}
            <div className="flex">
              <div className="select-none w-12 flex-shrink-0 text-right pr-3 py-4 text-xs font-mono text-ms-gray-600 bg-ms-gray-900 border-r border-ms-gray-800 leading-6">
                {code[activeFileId].split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <div className="flex-1 overflow-x-auto">
                <pre className="!bg-transparent !p-4 !m-0 !rounded-none text-xs leading-6">
                  <code ref={codeRef} className="language-python">
                    {code[activeFileId]}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !code[activeFileId] && (
          <div className="flex items-center justify-center h-full text-ms-gray-600 text-sm">
            Select a file to view its source code
          </div>
        )}
      </div>
    </div>
  )
}
