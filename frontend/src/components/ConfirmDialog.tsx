import { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Btn, Tone } from './ui'

/**
 * Blocking confirmation for an action that cannot be undone from the UI.
 * Deliberately separate from Modal: no close button in the corner, so the only
 * ways out are an explicit Cancel or Confirm.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  tone?: Extract<Tone, 'danger' | 'warning'>
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 animate-fade-in bg-ink-900/45 backdrop-blur-[2px]" onClick={onCancel} />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md animate-slide-up overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="flex gap-3.5 px-5 py-5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full
              ${tone === 'danger' ? 'bg-danger-50 text-danger-500' : 'bg-warning-50 text-warning-700'}`}
          >
            <AlertTriangle className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-md font-semibold tracking-snug text-ink-900">{title}</h2>
            <div className="mt-1.5 text-sm leading-relaxed text-ink-600">{message}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-200 bg-ink-50 px-5 py-3.5">
          <Btn variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Btn>
          <Btn variant={tone === 'danger' ? 'danger' : 'dark'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  )
}
