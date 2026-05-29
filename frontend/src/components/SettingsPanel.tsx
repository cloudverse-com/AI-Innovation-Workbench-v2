import React, { useState } from 'react'
import type { AppSettings, SystemPrompt } from '../types'

interface SettingsPanelProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
  availableModels: string[]
  systemPrompts: SystemPrompt[]
  showProcessingMode?: boolean
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  availableModels,
  systemPrompts,
  showProcessingMode = false,
}: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const update = (partial: Partial<AppSettings>) => {
    onSettingsChange({ ...settings, ...partial })
  }

  return (
    <div className="border-b border-ms-gray-200 bg-white">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-ms-gray-700 hover:text-ms-gray-900 hover:bg-ms-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-ms-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span>Settings</span>
          <span className="text-ms-gray-400 font-normal text-xs">
            {settings.model} · {settings.systemPrompt.name}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-ms-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-4 animate-fade-in">
          {/* Model selector */}
          <div>
            <label className="settings-label">Model</label>
            <select
              value={settings.model}
              onChange={e => update({ model: e.target.value })}
              className="settings-select"
            >
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Processing mode (only for Demo 01) */}
          {showProcessingMode && (
            <div>
              <label className="settings-label">File Processing</label>
              <select
                value={settings.processingMode}
                onChange={e => update({ processingMode: e.target.value as 'text' | 'vision' })}
                className="settings-select"
              >
                <option value="text">Text Extraction (PyMuPDF)</option>
                <option value="vision">Vision (GPT-4.1 Vision)</option>
              </select>
            </div>
          )}

          {/* System prompt selector */}
          <div className={showProcessingMode ? 'col-span-2' : ''}>
            <label className="settings-label">System Prompt</label>
            <select
              value={settings.systemPrompt.name}
              onChange={e => {
                const found = systemPrompts.find(p => p.name === e.target.value)
                if (found) update({ systemPrompt: found })
              }}
              className="settings-select"
            >
              {systemPrompts.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* System prompt text preview (editable) */}
          <div className="col-span-2">
            <label className="settings-label">Prompt Text</label>
            <textarea
              value={settings.systemPrompt.prompt}
              onChange={e => update({ systemPrompt: { ...settings.systemPrompt, prompt: e.target.value } })}
              rows={2}
              className="w-full text-sm bg-ms-gray-50 border border-ms-gray-300 rounded-lg px-3 py-2 text-ms-gray-900 focus:outline-none focus:ring-2 focus:ring-ms-blue resize-none scrollbar-thin"
            />
          </div>

          {/* API key */}
          <div className="col-span-2">
            <label className="settings-label">API Key (X-API-Key header)</label>
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={e => update({ apiKey: e.target.value })}
                className="flex-1 text-sm bg-ms-gray-50 border border-ms-gray-300 rounded-lg px-3 py-2 text-ms-gray-900 focus:outline-none focus:ring-2 focus:ring-ms-blue font-mono"
                placeholder="demo-key-12345"
              />
              <button
                onClick={() => setShowApiKey(s => !s)}
                className="px-3 py-2 text-xs border border-ms-gray-300 rounded-lg hover:bg-ms-gray-100 text-ms-gray-500"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
