import React, { useState } from 'react'
import type { Demo, DemoCategory } from '../types'

const DEMOS: Demo[] = [
  // ── Core Capabilities ────────────────────────────────────────────────────
  {
    id: 'demo01', routeId: 'demo-01',
    title: 'Chat Completion', subtitle: 'FoundryChatClient + Streaming',
    category: 'Core Capabilities', icon: '💬',
    description: 'Basic chat with streaming tokens, conversation history, and optional file uploads (PDF/image).',
    highlights: ['Streaming SSE responses', 'PDF text extraction (Docling)', 'Vision mode (GPT-4.1)', 'Conversation history'],
    supportsFileUpload: true, supportsStreaming: true,
    inputPlaceholder: 'Ask anything, or attach a PDF/image above...',
  },
  {
    id: 'demo02', routeId: 'demo-02',
    title: 'Foundry Agents', subtitle: 'Hosted Agents + Threads',
    category: 'Core Capabilities', icon: '🤖',
    description: 'Azure AI Foundry hosted agents with persistent threads. Agents store their own state in the cloud.',
    highlights: ['create_agent()', 'create_thread()', 'create_and_process_run()', 'Reusable agent IDs'],
    supportsSession: true,
    inputPlaceholder: 'Talk to a Foundry hosted agent...',
  },
  {
    id: 'demo03', routeId: 'demo-03',
    title: 'Function Tools', subtitle: '@tool decorator pattern',
    category: 'Core Capabilities', icon: '🔧',
    description: 'The @tool decorator registers Python functions as AI-callable tools. See the full tool-calling loop.',
    highlights: ['@tool decorator', 'Auto JSON schema', 'Multi-round tool loop', 'Tool registry'],
    inputPlaceholder: 'Try: "What\'s the weather in Tokyo?" or "Calculate 2^10"',
  },
  {
    id: 'demo04', routeId: 'demo-04',
    title: 'Multi-Turn Sessions', subtitle: 'Server-managed AgentSession',
    category: 'Core Capabilities', icon: '🔄',
    description: 'AgentSession stores conversation history server-side. Frontend only sends session_id + new message.',
    highlights: ['AgentSession dataclass', 'Server-side history', 'Session registry', 'Session lifecycle'],
    supportsSession: true, supportsStreaming: true,
    inputPlaceholder: 'Your session persists across messages...',
  },
  // ── Advanced Features ────────────────────────────────────────────────────
  {
    id: 'demo05', routeId: 'demo-05',
    title: 'Memory & Persistence', subtitle: 'ContextProvider pattern',
    category: 'Advanced Features', icon: '🧠',
    description: 'Context Providers inject remembered facts into every prompt. Type "remember that..." to store facts.',
    highlights: ['InMemoryContextProvider', 'Memory injection', '"remember that" command', 'Persistent across turns'],
    supportsSession: true, supportsStreaming: true,
    inputPlaceholder: 'Try: "Remember that I prefer Python" then ask something...',
  },
  {
    id: 'demo06', routeId: 'demo-06',
    title: 'Medical Report Analysis', subtitle: 'Azure Content Understanding',
    category: 'Advanced Features', icon: '🏥',
    description: 'Upload a medical report PDF and extract structured fields using Azure AI Content Understanding. No LLM chat — pure document intelligence.',
    highlights: ['PDF upload (drag & drop)', 'ContentUnderstandingClient', 'AnalysisInput(data=bytes)', 'Structured field extraction'],
    supportsFileUpload: true,
    inputPlaceholder: 'Upload a medical report PDF to analyze...',
  },
  {
    id: 'demo07', routeId: 'demo-07',
    title: 'Document Comparison', subtitle: 'Contract Analysis + Blob Storage',
    category: 'Advanced Features', icon: '📋',
    description: 'Upload a contract PDF to Azure Blob Storage, then run Azure Content Understanding to identify deviations, missing terms, and risk areas against a reference analyzer.',
    highlights: ['Blob Storage upload + SAS URL', 'Content Understanding analyze API', 'Clause-level diff detection', 'Risk & deviation report'],
    supportsFileUpload: true,
    inputPlaceholder: 'Upload a contract PDF to analyze...',
  },
  {
    id: 'demo08', routeId: 'demo-08',
    title: 'PDF Entity Extractor', subtitle: 'Docling + MS Agent (LLM only)',
    category: 'Advanced Features', icon: '🏷️',
    description: 'Upload any PDF — Docling converts it to Markdown, then an MS Agent calls the LLM to extract named entities: people, organizations, locations, dates, amounts, and key terms. No Azure Content Understanding required.',
    highlights: ['Docling PDF → Markdown', 'Agent + FoundryChatClient', 'LLM-based NER', 'Six entity categories'],
    supportsFileUpload: true,
    inputPlaceholder: 'Upload a PDF to extract entities...',
  },
  {
    id: 'demo09', routeId: 'demo-09',
    title: 'Document Q&A Agent', subtitle: 'Hosted Agent + PDF Attachment',
    category: 'Advanced Features', icon: '📎',
    description: 'Attach a PDF and ask a question. The document text is extracted (pymupdf) and sent together with your question to a hosted Azure AI Foundry agent, which streams its answer back.',
    highlights: ['PDF upload (drag & drop)', 'PDF text extraction', 'Hosted FoundryAgent by name', 'Streaming SSE response'],
    supportsFileUpload: true,
    inputPlaceholder: 'Attach a PDF and ask a question...',
  },
]

const CATEGORY_ORDER: DemoCategory[] = [
  'Core Capabilities',
  'Advanced Features',
]

const CATEGORY_ICONS: Record<DemoCategory, string> = {
  'Core Capabilities': '⚙️',
  'Advanced Features': '✨',
  'Agent Patterns': '🤖',
  'Workflows': '🔀',
  'Advanced': '🚀',
}

interface SidebarProps {
  selectedDemo: Demo
  onSelectDemo: (demo: Demo) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ selectedDemo, onSelectDemo, isCollapsed, onToggleCollapse }: SidebarProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const groupedDemos = CATEGORY_ORDER.map(cat => ({
    category: cat,
    demos: DEMOS.filter(d => d.category === cat),
  }))

  if (isCollapsed) {
    return (
      <div className="w-14 h-full bg-ms-gray-900 flex flex-col items-center py-4 gap-2 border-r border-ms-gray-800">
        <button
          onClick={onToggleCollapse}
          className="w-9 h-9 rounded-lg bg-ms-gray-800 hover:bg-ms-gray-700 flex items-center justify-center text-ms-gray-300 hover:text-white transition-colors mb-2"
          title="Expand sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {DEMOS.map(demo => (
          <button
            key={demo.id}
            onClick={() => onSelectDemo(demo)}
            title={demo.title}
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all ${
              selectedDemo.id === demo.id
                ? 'bg-ms-blue text-white'
                : 'text-ms-gray-400 hover:bg-ms-gray-800 hover:text-white'
            }`}
          >
            {demo.icon}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="w-64 h-full bg-ms-gray-900 flex flex-col border-r border-ms-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-ms-gray-800">
        <div>
          <div className="text-white font-semibold text-sm">AI Innovation</div>
          <div className="text-ms-gray-400 text-xs">Workbench</div>
        </div>
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-lg hover:bg-ms-gray-800 flex items-center justify-center text-ms-gray-400 hover:text-white transition-colors"
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Demo list */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {groupedDemos.map(({ category, demos }) => (
          <div key={category} className="mb-1">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-ms-gray-500 uppercase tracking-wider hover:text-ms-gray-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>{CATEGORY_ICONS[category]}</span>
                <span>{category}</span>
              </span>
              <svg
                className={`w-3 h-3 transition-transform ${collapsedCategories.has(category) ? '-rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Demo items */}
            {!collapsedCategories.has(category) && (
              <div className="px-2 space-y-0.5">
                {demos.map(demo => (
                  <button
                    key={demo.id}
                    onClick={() => onSelectDemo(demo)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                      selectedDemo.id === demo.id
                        ? 'bg-ms-blue text-white'
                        : 'text-ms-gray-300 hover:bg-ms-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="text-base flex-shrink-0">{demo.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{demo.title}</div>
                      <div className={`text-xs truncate ${selectedDemo.id === demo.id ? 'text-blue-200' : 'text-ms-gray-500'}`}>
                        {demo.subtitle}
                      </div>
                    </div>
                    <span className={`ml-auto text-xs flex-shrink-0 font-mono ${selectedDemo.id === demo.id ? 'text-blue-200' : 'text-ms-gray-600'}`}>
                      {demo.id.replace('demo', '')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-ms-gray-800 text-xs text-ms-gray-600">
        <div>Microsoft Azure AI</div>
        <div>Agent Framework Demos</div>
      </div>
    </div>
  )
}

export { DEMOS }
