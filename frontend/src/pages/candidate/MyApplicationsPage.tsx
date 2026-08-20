import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle, FileText, X } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { MyApplication, MySummary } from '../../types'
import { Modal, Field, inputClass } from '../../components/Modal'
import {
  Alert, Btn, Card, EmptyState, Loading, Pill, StatCard, Tone, moneyK,
} from '../../components/ui'

const statusTone: Record<string, Tone> = {
  SUBMITTED: 'neutral',
  UNDER_REVIEW: 'info',
  SHORTLISTED: 'success',
  INTERVIEWING: 'accent',
  OFFERED: 'warning',
  HIRED: 'success',
  NOT_PROGRESSING: 'danger',
  WITHDRAWN: 'neutral',
}

/** The journey shown as a progress rail, so "where am I?" is answered at a glance. */
function Progress({ step, total, closed, status }: { step: number; total: number; closed: boolean; status: string }) {
  if (step < 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <X className="h-3.5 w-3.5 text-danger-500" />
        {status === 'WITHDRAWN' ? 'You withdrew this application' : 'This application is closed'}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            i <= step ? (closed ? 'bg-success-500' : 'bg-accent-500') : 'bg-ink-200'
          }`}
        />
      ))}
      <span className="ml-1 shrink-0 font-mono text-2xs tnum text-ink-500">
        {step + 1}/{total}
      </span>
    </div>
  )
}

export function MyApplicationsPage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<MyApplication[]>([])
  const [summary, setSummary] = useState<MySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [withdrawing, setWithdrawing] = useState<MyApplication | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [apps, s] = await Promise.all([
        api.get<MyApplication[]>('/me/applications'),
        api.get<MySummary>('/me/summary'),
      ])
      setApplications(apps)
      setSummary(s)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your applications')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const withdraw = async () => {
    if (!withdrawing) return
    setSaving(true)
    try {
      await api.patch(`/me/applications/${withdrawing.id}/withdraw`, { reason: reason || undefined })
      setNotice('Application withdrawn — your recruiter has been told.')
      setWithdrawing(null)
      setReason('')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not withdraw the application')
    }
    setSaving(false)
  }

  if (loading) return <Loading label="Loading your applications" />

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <p className="text-sm text-ink-600">
        Hello {user?.firstName}. Here is where each of your applications stands.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applications" value={summary?.total ?? 0} note="All time" />
        <StatCard label="In progress" value={summary?.active ?? 0} note="Still being considered" />
        <StatCard label="Interviewing" value={summary?.interviewing ?? 0} note="Employer wants to meet" />
        <StatCard label="Offers" value={summary?.offers ?? 0} note="Offer stage or hired" />
      </div>

      {applications.length ? (
        <div className="space-y-3">
          {applications.map(a => (
            <Card key={a.id} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-4 py-3.5">
                <div className="min-w-0">
                  <h2 className="truncate text-md font-semibold tracking-snug text-ink-900">
                    {a.job?.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {a.company?.name}
                    {a.job?.location?.city ? ` · ${a.job.location.city}` : ''}
                    {a.job?.salaryMin ? ` · ${moneyK(a.job.salaryMin, a.job.currency)}–${moneyK(a.job.salaryMax, a.job.currency)}` : ''}
                  </p>
                </div>
                <Pill tone={statusTone[a.status] || 'neutral'}>{a.statusLabel}</Pill>
              </div>

              <div className="space-y-3 px-4 py-3.5">
                <Progress step={a.step} total={a.totalSteps} closed={a.closed} status={a.status} />
                {a.statusHint && <p className="text-sm text-ink-600">{a.statusHint}</p>}

                {a.resume && (
                  <button
                    type="button"
                    onClick={() =>
                      api
                        .download(`/resumes/${a.resume!.id}`, a.resume!.fileName)
                        .catch(e => setError(e instanceof ApiError ? e.message : 'Could not download that CV'))
                    }
                    className="inline-flex items-center gap-1.5 text-xs text-ink-500 transition-colors
                      duration-base ease-out hover:text-accent-700"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {/* The CV as it was sent, not whatever is on the profile now. */}
                    Sent with <span className="font-medium text-ink-700">{a.resume.fileName}</span>
                  </button>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-accent-600 hover:text-accent-700">
                    History
                  </summary>
                  <ol className="mt-2 space-y-2 border-l border-ink-200 pl-4">
                    {a.timeline.map((t, i) => (
                      <li key={i} className="relative text-xs">
                        <span className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-white">
                          {i === a.timeline.length - 1 ? (
                            <Circle className="h-2.5 w-2.5 fill-accent-500 text-accent-500" />
                          ) : (
                            <Check className="h-3 w-3 text-ink-400" />
                          )}
                        </span>
                        <p className="font-medium text-ink-800">{t.label}</p>
                        {t.note && <p className="text-ink-500">{t.note}</p>}
                        <p className="font-mono text-2xs text-ink-400">
                          {new Date(t.at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>

              {!a.closed && (
                <div className="flex justify-end border-t border-ink-200 bg-ink-50 px-4 py-2.5">
                  <Btn size="sm" variant="ghost" onClick={() => setWithdrawing(a)}>
                    Withdraw
                  </Btn>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No applications yet"
          hint="Browse the open roles and apply — you will be able to follow each one here."
          action={<Link to="/careers" className="btn btn-md btn-primary">Browse open roles</Link>}
        />
      )}

      <Modal
        open={Boolean(withdrawing)}
        title="Withdraw application"
        description={withdrawing ? `${withdrawing.job?.title} at ${withdrawing.company?.name}` : ''}
        onClose={() => setWithdrawing(null)}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setWithdrawing(null)}>Keep it open</Btn>
            <Btn variant="danger" loading={saving} onClick={withdraw}>Withdraw</Btn>
          </>
        }
      >
        <Field label="Reason" hint="Optional — shared with your recruiter so they can send better matches.">
          <textarea rows={3} className={inputClass} value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}
