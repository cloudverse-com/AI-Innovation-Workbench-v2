import React, { useEffect, useRef, useState, KeyboardEvent } from 'react'
import type { ChatMessage, Demo } from '../types'

interface ChatPanelProps {
  demo: Demo
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  onSend: (message: string) => void
  onClear: () => void
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
    </svg>
  )
}

function AIIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
        isUser
          ? 'bg-ms-blue text-white'
          : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm'
      }`}>
        {isUser ? <UserIcon /> : <AIIcon />}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
          {message.isStreaming && !message.content ? (
            <span className="inline-flex gap-1">
              <span className="w-2 h-2 bg-ms-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-ms-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-ms-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          ) : (
            <span className={message.isStreaming ? 'streaming-cursor' : ''}>
              {formatMessageContent(message.content)}
            </span>
          )}
        </div>

        {/* Tool calls used */}
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.toolsUsed.map((tool, i) => (
              <span key={i} className="tool-badge">
                🔧 {tool.tool}
              </span>
            ))}
          </div>
        )}

        {/* Metadata */}
        {message.metadata && Object.keys(message.metadata).length > 0 && !message.isStreaming && (
          <MetadataPanel metadata={message.metadata} />
        )}

        <span className="text-xs text-ms-gray-400">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

function formatMessageContent(content: string): React.ReactNode {
  // Simple markdown-like formatting
  const lines = content.split('\n')
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </React.Fragment>
  ))
}

function MetadataPanel({ metadata }: { metadata: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)

  // Filter out boring metadata keys
  const relevant = Object.entries(metadata).filter(
    ([k]) => !['done', 'token'].includes(k)
  )
  if (relevant.length === 0) return null

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-ms-gray-400 hover:text-ms-gray-600 flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        metadata
      </button>
      {expanded && (
        <div className="mt-1 bg-ms-gray-100 rounded-lg px-3 py-2 font-mono text-ms-gray-600 space-y-0.5">
          {relevant.map(([k, v]) => (
            <div key={k}>
              <span className="text-ms-blue">{k}</span>: {JSON.stringify(v)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ChatPanel({ demo, messages, isLoading, error, onSend, onClear }: ChatPanelProps) {
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [inputText])

  const handleSend = () => {
    const text = inputText.trim()
    if (!text || isLoading) return
    onSend(text)
    setInputText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-ms-gray-50">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-ms-gray-200">
        <div>
          <h2 className="font-semibold text-ms-gray-900 flex items-center gap-2">
            <span>{demo.icon}</span>
            <span>{demo.title}</span>
          </h2>
          <p className="text-xs text-ms-gray-500">{demo.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-ms-gray-400 hover:text-ms-gray-600 px-3 py-1.5 rounded-lg hover:bg-ms-gray-100 transition-colors"
            >
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Demo description (shown when no messages) */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="text-5xl mb-4">{demo.icon}</div>
            <h3 className="text-lg font-semibold text-ms-gray-900 mb-2">{demo.title}</h3>
            <p className="text-ms-gray-500 text-sm mb-6">{demo.description}</p>
            <div className="text-left space-y-2">
              {demo.highlights.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-ms-gray-600">
                  <span className="w-5 h-5 rounded-full bg-ms-blue/10 text-ms-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="flex flex-col justify-end min-h-full p-6 space-y-6">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-ms-gray-200 bg-white p-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={demo.inputPlaceholder || 'Type a message...'}
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-xl border border-ms-gray-300 px-4 py-3 pr-12 text-sm text-ms-gray-900 placeholder-ms-gray-400 focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent disabled:opacity-50 bg-ms-gray-50 scrollbar-thin"
              style={{ minHeight: '48px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            className="h-12 w-12 rounded-xl bg-ms-blue hover:bg-ms-blue-dark disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
            title="Send (Enter)"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-ms-gray-400 mt-2 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
