import { useState, useRef, useEffect, useCallback } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { LoadingState, ErrorState } from '../ui/Misc'
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface CodeModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  content: string
  loading?: boolean
  error?: string
  onRefresh?: () => void
  refreshing?: boolean
}

export default function CodeModal({
  open,
  onClose,
  title,
  description,
  content,
  loading,
  error,
  onRefresh,
  refreshing,
}: CodeModalProps) {
  const [copied, setCopied] = useState(false)

  const preRef = useRef<HTMLPreElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = preRef.current
    if (!el) return

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => {
    if (!open) return
    scrollToBottom()
  }, [open, content, scrollToBottom])

  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} wide>
      <div className="space-y-3">
        <div className="flex items-center justify-end gap-1.5">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              loading={refreshing}
              onClick={onRefresh}
              title="Refresh"
            >
              {!refreshing && <ArrowPathIcon className="w-3.5 h-3.5" />}
              Refresh
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            disabled={!content}
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckIcon className="w-3.5 h-3.5 text-success" />
            ) : (
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        {loading ? (
          <div className="bg-bg-primary border border-border rounded-lg">
            <LoadingState text="Loading..." />
          </div>
        ) : error ? (
          <div className="bg-bg-primary border border-border rounded-lg">
            <ErrorState message={error} onRetry={onRefresh} />
          </div>
        ) : (
          <pre
            ref={preRef}
            className="bg-bg-primary border border-border rounded-lg p-4 text-xs font-mono leading-relaxed
              text-text-secondary overflow-auto max-h-[60vh] whitespace-pre-wrap break-words"
          >
            {content || 'No content'}
          </pre>
        )}
      </div>
    </Modal>
  )
}
