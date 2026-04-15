import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
  requireTyping?: string
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
            <AlertTriangle size={18} className={variant === 'danger' ? 'text-red-400' : 'text-amber-400'} />
          </div>
          <h3 className="text-base font-semibold text-white font-['Sora',sans-serif]">{title}</h3>
        </div>
        <p className="text-sm text-zinc-400 mb-4">{message}</p>

        {requireTyping && (
          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-2">
              Type <code className="text-zinc-300 bg-white/10 px-1 rounded">{requireTyping}</code> to confirm
            </p>
            <input
              ref={inputRef}
              type="text"
              value={typedValue}
              onChange={e => setTypedValue(e.target.value)}
              placeholder={requireTyping}
              className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmEnabled}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
