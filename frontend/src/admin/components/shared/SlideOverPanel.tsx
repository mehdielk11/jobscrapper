import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface SlideOverPanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  children: React.ReactNode
}

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-5xl',
  '3xl': 'max-w-7xl',
}

/**
 * Accessible slide-over panel from the right.
 * Traps focus, closes on Escape key and backdrop click.
 */
export function SlideOverPanel({ isOpen, onClose, title, width = 'md', children }: SlideOverPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative ml-auto h-full w-full ${widthClasses[width]} bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground font-['Sora',sans-serif]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
