import { ChangeEvent, useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, Trash2, Download } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { ResumeRef } from '../types'
import { Btn } from './ui'

/** Mirrors the allowlist in backend/src/modules/resumes/resume-storage.service.ts. */
const ACCEPT = '.pdf,.doc,.docx'
const MAX_BYTES = 5 * 1024 * 1024

export const readableSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/**
 * Attach a CV.
 *
 * The file goes up on selection rather than with the surrounding form, so the
 * applicant finds out it was rejected while they can still fix it — not after
 * filling in ten fields. `endpoint` decides who owns the upload: the public one
 * parks it until an application claims it, `/me/resume` attaches it outright.
 */
export function ResumeField({
  endpoint,
  value,
  onChange,
  required = false,
  label = 'CV',
  hint,
  downloadable = false,
}: {
  endpoint: string
  value: ResumeRef | null
  onChange: (resume: ResumeRef | null) => void
  required?: boolean
  label?: string
  hint?: string
  downloadable?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Let the same file be chosen again after a failure.
    e.target.value = ''
    if (!file) return

    // Checked here purely so an obvious mistake does not cost an upload; the
    // API validates properly, including the file's own signature.
    if (file.size > MAX_BYTES) {
      setError(`That file is ${readableSize(file.size)}. The limit is 5 MB.`)
      return
    }

    setBusy(true)
    setError('')
    try {
      onChange(await api.upload<ResumeRef>(endpoint, file))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That file could not be uploaded')
    }
    setBusy(false)
  }

  return (
    <div>
      <span className="eyebrow mb-1.5 block">
        {label}
        {required && <span className="ml-1 text-danger-600">required</span>}
      </span>

      {value ? (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-ink-200 bg-ink-50 px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-ink-400" />
          <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{value.fileName}</span>
          <span className="shrink-0 font-mono text-2xs tnum text-ink-500">{readableSize(value.sizeBytes)}</span>
          {downloadable && (
            <button
              type="button"
              onClick={() => api.download(`/resumes/${value.id}`, value.fileName).catch(() => setError('Could not download that CV'))}
              className="text-ink-500 transition-colors duration-base ease-out hover:text-ink-800"
              aria-label={`Download ${value.fileName}`}
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="text-xs font-medium text-accent-600 hover:text-accent-700"
          >
            Replace
          </button>
          {!required && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-ink-400 transition-colors duration-base ease-out hover:text-danger-600"
              aria-label="Remove CV"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <Btn
          type="button"
          variant="secondary"
          onClick={() => input.current?.click()}
          disabled={busy}
          icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        >
          {busy ? 'Uploading…' : 'Choose a file'}
        </Btn>
      )}

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        onChange={pick}
        className="sr-only"
        tabIndex={-1}
      />

      <p className={`mt-1.5 text-xs ${error ? 'text-danger-600' : 'text-ink-500'}`}>
        {error || hint || 'PDF or Word, up to 5 MB.'}
      </p>
    </div>
  )
}
