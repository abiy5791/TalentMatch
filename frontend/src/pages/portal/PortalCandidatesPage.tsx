import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, Star, ThumbsDown } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { Submission } from '../../types'
import { Modal, Field, inputClass } from '../../components/Modal'
import {
  Alert, Avatar, Btn, Card, EmptyState, Loading, Pill, Segmented, Tag, Tone, humanize, money,
} from '../../components/ui'

const statusTone: Record<string, Tone> = {
  SENT: 'warning',
  VIEWED: 'info',
  SHORTLISTED: 'success',
  INTERVIEW_REQUESTED: 'accent',
  DECLINED: 'danger',
}

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'NEW', label: 'To review' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'INTERVIEW_REQUESTED', label: 'Interviewing' },
  { value: 'DECLINED', label: 'Declined' },
] as const

type Filter = (typeof FILTERS)[number]['value']
type Decision = 'SHORTLIST' | 'INTERVIEW' | 'DECLINE'

const DECISION_COPY: Record<Decision, { title: string; hint: string; cta: string }> = {
  SHORTLIST: {
    title: 'Shortlist candidate',
    hint: 'Tells your recruiter this profile is of interest.',
    cta: 'Shortlist',
  },
  INTERVIEW: {
    title: 'Request an interview',
    hint: 'Your recruiter will arrange the introduction and confirm times with you.',
    cta: 'Request interview',
  },
  DECLINE: {
    title: 'Decline candidate',
    hint: 'Saying why helps your recruiter send closer matches next time.',
    cta: 'Decline',
  },
}

export function PortalCandidatesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [active, setActive] = useState<{ submission: Submission; decision: Decision } | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSubmissions(await api.get<Submission[]>('/portal/candidates'))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load submitted talent')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const visible = submissions.filter(s => {
    if (filter === 'ALL') return true
    if (filter === 'NEW') return ['SENT', 'VIEWED'].includes(s.status)
    return s.status === filter
  })

  const respond = async () => {
    if (!active) return
    setSaving(true)
    try {
      const updated = await api.patch<Submission>(`/portal/candidates/${active.submission.id}/respond`, {
        decision: active.decision,
        note: note || undefined,
      })
      setSubmissions(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s)))
      setNotice(
        active.decision === 'INTERVIEW'
          ? 'Interview requested — your recruiter will be in touch to arrange it.'
          : `Thanks — your recruiter has been notified.`,
      )
      setActive(null)
      setNote('')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your response')
    }
    setSaving(false)
  }

  if (loading) return <Loading label="Loading submitted talent" />

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={filter} onChange={setFilter} options={FILTERS as any} />
        <span className="text-xs text-ink-500">{visible.length} of {submissions.length}</span>
      </div>

      {visible.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map(s => {
            const c = s.candidate
            const name = `${c?.firstName || ''} ${c?.lastName || ''}`.trim()
            const settled = ['DECLINED'].includes(s.status)
            return (
              <Card key={s.id} className="overflow-hidden">
                <div className="flex items-start gap-3 border-b border-ink-200 px-4 py-3.5">
                  <Avatar name={name || '—'} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink-900">
                      {name}
                      {c?.verified && <Pill tone="success">Verified</Pill>}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {c?.currentTitle}{c?.currentCompany ? ` · ${c.currentCompany}` : ''}
                    </p>
                  </div>
                  <Pill tone={statusTone[s.status] || 'neutral'}>{humanize(s.status)}</Pill>
                </div>

                <div className="space-y-3 px-4 py-3.5">
                  <p className="text-xs text-ink-500">
                    Submitted for <span className="font-medium text-ink-800">{s.job?.title}</span>
                  </p>

                  {s.message && (
                    <p className="rounded-sm border-l-2 border-l-accent-400 bg-ink-50 px-3 py-2 text-xs text-ink-700">
                      {s.message}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {c?.skills?.slice(0, 6).map(sk => <Tag key={sk.skillName}>{sk.skillName}</Tag>)}
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-ink-500">Experience</dt>
                      <dd className="font-mono tnum text-ink-900">{c?.experienceYears ?? '—'} yrs</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Expectation</dt>
                      <dd className="font-mono tnum text-ink-900">
                        {c?.salaryExpectationMin ? `${money(c.salaryExpectationMin, c.currency)}+` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Available</dt>
                      <dd className="text-ink-900">{humanize(c?.availability) || '—'}</dd>
                    </div>
                  </dl>

                  {s.clientNote && (
                    <p className="text-xs text-ink-500">
                      <span className="font-medium text-ink-700">Your note:</span> {s.clientNote}
                    </p>
                  )}
                </div>

                {!settled && (
                  <div className="flex flex-wrap gap-2 border-t border-ink-200 bg-ink-50 px-4 py-3">
                    <Btn
                      size="sm"
                      variant="dark"
                      icon={<CalendarCheck className="h-3.5 w-3.5" />}
                      onClick={() => setActive({ submission: s, decision: 'INTERVIEW' })}
                    >
                      Request interview
                    </Btn>
                    {s.status !== 'SHORTLISTED' && (
                      <Btn
                        size="sm"
                        icon={<Star className="h-3.5 w-3.5" />}
                        onClick={() => setActive({ submission: s, decision: 'SHORTLIST' })}
                      >
                        Shortlist
                      </Btn>
                    )}
                    <Btn
                      size="sm"
                      variant="ghost"
                      icon={<ThumbsDown className="h-3.5 w-3.5" />}
                      onClick={() => setActive({ submission: s, decision: 'DECLINE' })}
                    >
                      Decline
                    </Btn>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="Nothing here yet"
          hint="Candidates appear once your recruiter submits them for one of your roles."
        />
      )}

      <Modal
        open={Boolean(active)}
        title={active ? DECISION_COPY[active.decision].title : ''}
        description={
          active
            ? `${active.submission.candidate?.firstName} ${active.submission.candidate?.lastName} — ${active.submission.job?.title}`
            : ''
        }
        onClose={() => { setActive(null); setNote('') }}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setActive(null); setNote('') }}>Cancel</Btn>
            <Btn
              variant={active?.decision === 'DECLINE' ? 'danger' : 'primary'}
              loading={saving}
              onClick={respond}
            >
              {active ? DECISION_COPY[active.decision].cta : ''}
            </Btn>
          </>
        }
      >
        <Field label="Note for your recruiter" hint={active ? DECISION_COPY[active.decision].hint : ''}>
          <textarea
            rows={4}
            className={inputClass}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={
              active?.decision === 'DECLINE'
                ? 'e.g. Looking for more depth in distributed systems'
                : 'e.g. Available Tuesday or Thursday afternoon'
            }
          />
        </Field>
      </Modal>
    </div>
  )
}
