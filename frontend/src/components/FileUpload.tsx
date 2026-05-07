import React, { useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { UploadedFile } from '../types'

interface FileUploadProps {
  uploadedFile: UploadedFile | null
  onFileChange: (file: UploadedFile | null) => void
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']
const MAX_SIZE_MB = 20

export function FileUpload({ uploadedFile, onFileChange }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const processFile = useCallback((file: File) => {
    setError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Unsupported file type. Accepted: PDF, JPG, PNG`)
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size: ${MAX_SIZE_MB}MB`)
      return
    }

    onFileChange({
      id: uuidv4(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    })
  }, [onFileChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return '📄'
    if (type.startsWith('image/')) return '🖼️'
    return '📁'
  }

  if (uploadedFile) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-ms-blue/5 border border-ms-blue/20 rounded-lg">
        <span className="text-lg">{getFileIcon(uploadedFile.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ms-gray-900 truncate">{uploadedFile.name}</div>
          <div className="text-xs text-ms-gray-500">{formatSize(uploadedFile.size)}</div>
        </div>
        <button
          onClick={() => onFileChange(null)}
          className="w-6 h-6 rounded-full hover:bg-ms-gray-200 flex items-center justify-center text-ms-gray-400 hover:text-ms-gray-700 transition-colors flex-shrink-0"
          title="Remove file"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? 'border-ms-blue bg-ms-blue/5 text-ms-blue'
            : 'border-ms-gray-300 hover:border-ms-blue/50 hover:bg-ms-gray-50 text-ms-gray-400 hover:text-ms-gray-600'
        }`}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span className="text-sm">
          {isDragging ? 'Drop to upload' : 'Attach PDF, JPG, or PNG · drag & drop or click'}
        </span>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }}
        className="hidden"
      />
    </div>
  )
}
