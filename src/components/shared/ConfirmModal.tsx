import { X, AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'accent' | 'ok'
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'accent'
}: ConfirmModalProps) {
  if (!isOpen) return null

  const variantClasses = {
    danger: 'bg-danger hover:bg-danger/90',
    accent: 'bg-accent hover:bg-accent/90',
    ok: 'bg-ok hover:bg-ok/90'
  }

  const iconColors = {
    danger: 'text-danger',
    accent: 'text-accent',
    ok: 'text-ok'
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-void/80 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onCancel}
      />
      
      <div className="relative w-full max-w-md scale-100 overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/5 ${iconColors[variant]}`}>
            <AlertTriangle size={24} />
          </div>
          <button 
            onClick={onCancel}
            className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-xl font-display italic text-white">{title}</h3>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            {message}
          </p>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="h-11 rounded-xl border border-border px-6 text-sm font-semibold text-white transition-colors hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`h-11 rounded-xl px-6 text-sm font-semibold text-white transition-all ${variantClasses[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
