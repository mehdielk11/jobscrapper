import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
  requireTyping?: string
  isLoading?: boolean
}

/**
 * Reusable destructive action confirmation modal.
 * Optionally requires the user to type a phrase before confirming.
 */
export function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  requireTyping,
  isLoading = false,
}: ConfirmModalProps) {
  const [typedValue, setTypedValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isConfirmEnabled = requireTyping
    ? typedValue === requireTyping
    : true

  useEffect(() => {
    if (isOpen) {
      setTypedValue('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const btnClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600'
    : 'bg-amber-500 hover:bg-amber-600'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-destructive/10' : 'bg-amber-500/10'}`}>
            <AlertTriangle size={18} className={variant === 'danger' ? 'text-destructive' : 'text-amber-500'} />
          </div>
          <h3 className="text-base font-semibold text-foreground font-['Sora',sans-serif]">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>

        {requireTyping && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">
              Type <code className="text-foreground bg-muted px-1.5 py-0.5 rounded font-mono font-bold">{requireTyping}</code> to confirm
            </p>
            <input
              ref={inputRef}
              type="text"
              value={typedValue}
              onChange={e => setTypedValue(e.target.value)}
              placeholder={requireTyping}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmEnabled || isLoading}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${btnClass} shadow-lg shadow-primary/10`}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
