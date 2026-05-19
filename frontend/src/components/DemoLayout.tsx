import React, { useState } from 'react'
import type { Demo, AppSettings, SystemPrompt } from '../types'
import { ChatPanel } from './ChatPanel'
import { CodePanel } from './CodePanel'
import { ContentUnderstandingPanel } from './ContentUnderstandingPanel'
import { ContractComparisonPanel } from './ContractComparisonPanel'
import { SettingsPanel } from './SettingsPanel'
import { useChat } from '../hooks/useChat'

interface DemoLayoutProps {
  demo: Demo
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  availableModels: string[]
  systemPrompts: SystemPrompt[]
}

type PanelMode = 'chat-only' | 'split' | 'code-only'

export function DemoLayout({
  demo,
  settings,
  onSettingsChange,
  availableModels,
  systemPrompts,
}: DemoLayoutProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>('split')

  const { messages, isLoading, error, sendMessage, clearMessages } = useChat({
    demoId: demo.id,
    settings,
  })

  const handleSend = (message: string) => {
    sendMessage(message)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: settings + panel toggle */}
      <div className="flex-shrink-0">
        <SettingsPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
          availableModels={availableModels}
          systemPrompts={systemPrompts}
          showProcessingMode={demo.supportsFileUpload}
        />

        {/* Panel mode toggle */}
        <div className="flex items-center justify-end gap-1 px-4 py-2 bg-ms-gray-100 border-b border-ms-gray-200">
          <span className="text-xs text-ms-gray-400 mr-2">View:</span>
          {(
            [
              { mode: 'chat-only' as PanelMode, icon: '💬', label: 'Chat' },
              { mode: 'split' as PanelMode, icon: '⬛⬛', label: 'Split' },
              { mode: 'code-only' as PanelMode, icon: '</>', label: 'Code' },
            ] as const
          ).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => setPanelMode(mode)}
              title={label}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                panelMode === mode
                  ? 'bg-ms-blue text-white'
                  : 'text-ms-gray-500 hover:text-ms-gray-700 hover:bg-ms-gray-200'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Main content panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat / specialized panel */}
        {panelMode !== 'code-only' && (
          <div className={`flex flex-col overflow-hidden ${panelMode === 'split' ? 'w-1/2 border-r border-ms-gray-200' : 'w-full'}`}>
            {demo.id === 'demo06' ? (
              <ContentUnderstandingPanel demo={demo} />
            ) : demo.id === 'demo07' ? (
              <ContractComparisonPanel demo={demo} />
            ) : (
              <ChatPanel
                demo={demo}
                messages={messages}
                isLoading={isLoading}
                error={error}
                onSend={handleSend}
                onClear={clearMessages}
              />
            )}
          </div>
        )}

        {/* Code panel */}
        {panelMode !== 'chat-only' && (
          <div className={`flex flex-col overflow-hidden ${panelMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <CodePanel demoId={demo.id} />
          </div>
        )}
      </div>
    </div>
  )
}
