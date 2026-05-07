import React, { useEffect, useState } from 'react'
import type { AppSettings, Demo, SystemPrompt } from './types'
import { Sidebar, DEMOS } from './components/Sidebar'
import { DemoLayout } from './components/DemoLayout'

const DEFAULT_API_KEY = 'demo-key-12345'
const DEFAULT_SYSTEM_PROMPT: SystemPrompt = {
  name: 'General Assistant',
  prompt: 'You are a helpful assistant.',
}

function App() {
  const [selectedDemo, setSelectedDemo] = useState<Demo>(DEMOS[0])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>(['gpt-4.1'])
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([DEFAULT_SYSTEM_PROMPT])
  const [configLoaded, setConfigLoaded] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  const [settings, setSettings] = useState<AppSettings>({
    model: 'gpt-4.1',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    processingMode: 'text',
    apiKey: DEFAULT_API_KEY,
  })

  // Load models and system prompts from the backend on startup
  useEffect(() => {
    const headers = { 'X-API-Key': settings.apiKey }

    Promise.all([
      fetch('/api/models', { headers }).then(r => r.json()),
      fetch('/api/system-prompts', { headers }).then(r => r.json()),
    ])
      .then(([modelsData, promptsData]) => {
        const models: string[] = modelsData.models ?? ['gpt-4.1']
        const prompts: SystemPrompt[] = promptsData.system_prompts ?? [DEFAULT_SYSTEM_PROMPT]

        setAvailableModels(models)
        setSystemPrompts(prompts)
        setSettings(prev => ({
          ...prev,
          model: modelsData.default ?? models[0],
          systemPrompt: prompts[0] ?? DEFAULT_SYSTEM_PROMPT,
        }))
        setConfigLoaded(true)
      })
      .catch(err => {
        setConfigError(`Failed to connect to backend: ${err.message}`)
        setConfigLoaded(true)
      })
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When API key changes, re-fetch config
  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ms-gray-100">
      {/* Sidebar */}
      <Sidebar
        selectedDemo={selectedDemo}
        onSelectDemo={setSelectedDemo}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Config error banner */}
        {configError && (
          <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
            <span className="text-amber-600">⚠️</span>
            <div className="text-sm text-amber-800">
              <span className="font-medium">Backend connection issue:</span> {configError}
              <span className="ml-2 text-amber-600">
                Make sure the FastAPI server is running: <code className="font-mono bg-amber-100 px-1 rounded">uvicorn backend.main:app --port 8000 --reload</code>
              </span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {!configLoaded ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-10 h-10 text-ms-blue animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div className="text-ms-gray-500 text-sm">Connecting to AI Innovation Workbench...</div>
            </div>
          </div>
        ) : (
          <DemoLayout
            demo={selectedDemo}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            availableModels={availableModels}
            systemPrompts={systemPrompts}
          />
        )}
      </main>
    </div>
  )
}

export default App
