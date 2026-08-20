import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ExternalLink, FileText, Inbox, Mail } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { ApplicationRow, ApplicationStatus, Job } from '../types'
import { Modal, Field, inputClass, selectClass } from '../components/Modal'
import { readableSize } from '../components/ResumeField'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import {
  Alert, Avatar, Btn, Card, EmptyState, Loading, Pill, SearchInput, StatCard, Toolbar, Tone,
  humanize,
} from '../components/ui'

/**
 * The statuses a recruiter sets by hand. Mirrors MANUAL_STATUSES in
 * backend/src/modules/applications/applications.service.ts — WITHDRAWN is
 * absent because only the applicant can withdraw.
 */
const MANUAL_STATUSES: ApplicationStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'HIRED', 'NOT_PROGRESSING',
]

const STATUS_TONE: Record<string, Tone> = {
  SUBMITTED: 'neutral',
  UNDER_REVIEW: 'info',
  SHORTLISTED: 'success',
  INTERVIEWING: 'warning',
  OFFERED: 'accent',
  HIRED: 'success',
  NOT_PROGRESSING: 'danger',
  WITHDRAWN: 'neutral',
}

/** The note a recruiter would otherwise have to type every time. */
const DEFAULT_NOTE: Record<string, string> = {
  UNDER_REVIEW: 'A recruiter is reviewing your profile.',
  SHORTLISTED: 'Your profile has been shared with the hiring team.',
  INTERVIEWING: 'The employer would like to meet you.',
  OFFERED: 'An offer is being prepared.',
  HIRED: 'Congratulations — the role is yours.',
  NOT_PROGRESSING: 'Thank you for applying. We will not be taking this application further.',
}

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/**
 * Inbound applications from the public board. The board is only half of the
 * flow — this is where a person who applied stops being a row in a table and
 * gets an answer, and every move here writes the timeline they read on /me.
 */
export function ApplicationsPage() {
  const { can } = useAuth()
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [moving, setMoving] = useState<ApplicationRow | null>(null)
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>('UNDER_REVIEW')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const canWrite = can(P.CANDIDATES_WRITE)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [apps, jobList] = await Promise.all([
        api.get<ApplicationRow[]>('/applications', { limit: 200 }),
        api.get<Job[]>('/jobs', { limit: 200 }),
      ])
      setApplications(apps)
      setJobs(jobList)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load applications')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const count = (statuses: string[]) => applications.filter(a => statuses.includes(a.status)).length
    return {
      total: applications.length,
      awaiting: count(['SUBMITTED']),
      inReview: count(['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED']),
      hired: count(['HIRED']),
    }
  }, [applications])

  const filtered = applications.filter(a => {
    const term = search.trim().toLowerCase()
    const name = `${a.candidate?.firstName || ''} ${a.candidate?.lastName || ''}`.toLowerCase()
    const matchSearch =
      !term ||
      name.includes(term) ||
      (a.candidate?.email || '').toLowerCase().includes(term) ||
      (a.job?.title || '').toLowerCase().includes(term)
    return matchSearch && (!statusFilter || a.status === statusFilter) && (!jobFilter || a.job?.id === jobFilter)
  })

  const openMove = (application: ApplicationRow, status: ApplicationStatus) => {
    setMoving(application)
    setNextStatus(status)
    setNote(DEFAULT_NOTE[status] || '')
  }

  const move = async () => {
    if (!moving) return
    setSaving(true)
    setError('')
    try {
      await api.patch(`/applications/${moving.id}/status`, { status: nextStatus, note: note || undefined })
      setApplications(prev =>
        prev.map(a => (a.id === moving.id ? { ...a, status: nextStatus, updatedAt: new Date().toISOString() } : a)),
      )
      const who = `${moving.candidate?.firstName} ${moving.candidate?.lastName}`
      setNotice(`${who} moved to ${humanize(nextStatus).toLowerCase()} — they can see it on their tracker.`)
      setMoving(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update the application')
    }
    setSaving(false)
  }

  /** The one move a recruiter makes most often, offered inline on the card. */
  const quickNext = (status: string): ApplicationStatus | null => {
    const order: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'HIRED']
    const i = order.indexOf(status as ApplicationStatus)
    return i >= 0 && i < order.length - 1 ? order[i + 1] : null
  }

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applications" value={stats.total} note="All roles" />
        <StatCard label="Awaiting first review" value={stats.awaiting} note="Nobody has looked yet" />
        <StatCard label="In progress" value={stats.inReview} note="Between review and offer" />
        <StatCard label="Hired" value={stats.hired} note="Closed as a hire" />
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search applicant, email or role" className="max-w-md" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-auto">
          <option value="">All statuses</option>
          {[...MANUAL_STATUSES, 'WITHDRAWN'].map(s => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </select>
        <select value={jobFilter} onChange={e => setJobFilter(e.target.value)} className="select w-auto">
          <option value="">All roles</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <span className="ml-auto text-xs text-ink-500">
          {filtered.length} of {applications.length}
        </span>
      </Toolbar>

      {loading ? (
        <Loading label="Loading applications" />
      ) : filtered.length ? (
        <div className="space-y-2.5">
          {filtered.map(a => {
            const name = `${a.candidate?.firstName || ''} ${a.candidate?.lastName || ''}`.trim() || 'Applicant'
            const next = quickNext(a.status)
            const closed = ['WITHDRAWN', 'HIRED', 'NOT_PROGRESSING'].includes(a.status)
            return (
              <Card key={a.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start gap-3 px-4 py-3.5">
                  <Avatar name={name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-md font-semibold tracking-snug text-ink-900">{name}</h3>
                      <Pill tone={STATUS_TONE[a.status] || 'neutral'}>{humanize(a.status)}</Pill>
                      {a.source === 'PUBLIC_BOARD' && <Pill tone="info">Careers site</Pill>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-600">
                      {a.job?.title}
                      {a.company?.name ? ` · ${a.company.name}` : ''}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {a.candidate?.email}
                      </span>
                      {a.candidate?.currentTitle && <span>{a.candidate.currentTitle}</span>}
                      {a.candidate?.experienceYears != null && (
                        <span className="font-mono tnum">{a.candidate.experienceYears}y exp</span>
                      )}
                      <span>Applied {ago(a.appliedAt)}</span>
                    </p>

                    {a.resume ? (
                      <button
                        type="button"
                        onClick={() =>
                          api
                            .download(`/resumes/${a.resume!.id}`, a.resume!.fileName)
                            .catch(e => setError(e instanceof ApiError ? e.message : 'Could not download that CV'))
                        }
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xs border border-ink-200
                          bg-ink-50 px-2 py-1 text-xs text-ink-700 transition-colors duration-base ease-out
                          hover:border-ink-300 hover:bg-ink-100"
                      >
                        <FileText className="h-3.5 w-3.5 text-ink-400" />
                        <span className="max-w-[220px] truncate">{a.resume.fileName}</span>
                        <span className="font-mono text-2xs tnum text-ink-500">
                          {readableSize(a.resume.sizeBytes)}
                        </span>
                        <Download className="h-3.5 w-3.5 text-ink-400" />
                      </button>
                    ) : (
                      <p className="mt-1.5 text-xs text-ink-400">No CV attached</p>
                    )}
                  </div>

                  {canWrite && !closed && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {next && (
                        <Btn size="sm" variant="primary" onClick={() => openMove(a, next)}>
                          Move to {humanize(next).toLowerCase()}
                        </Btn>
                      )}
                      <Btn size="sm" variant="ghost" onClick={() => openMove(a, 'NOT_PROGRESSING')}>
                        Decline
                      </Btn>
                    </div>
                  )}
                </div>

                {a.coverNote && (
                  <p className="border-t border-ink-200 bg-ink-50 px-4 py-2.5 text-sm italic text-ink-600">
                    “{a.coverNote}”
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title={applications.length ? 'No applications match these filters' : 'No applications yet'}
            hint={
              applications.length
                ? 'Try a different status or role.'
                : 'Applications arrive here the moment somebody applies on the careers site. Publish a role to open the board.'
            }
            action={
              applications.length ? (
                <Btn
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('')
                    setJobFilter('')
                  }}
                >
                  Reset filters
                </Btn>
              ) : (
                <Link to="/jobs" className="btn btn-md btn-primary">
                  <Inbox className="h-4 w-4" /> Go to jobs
                </Link>
              )
            }
          />
        </Card>
      )}

      <a
        href="/careers"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open the public careers site
      </a>

      <Modal
        open={Boolean(moving)}
        title="Move this application"
        description={
          moving
            ? `${moving.candidate?.firstName} ${moving.candidate?.lastName} — ${moving.job?.title}`
            : ''
        }
        onClose={() => setMoving(null)}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setMoving(null)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={move}>
              {saving ? 'Saving…' : 'Update and notify'}
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New status">
            <select
              className={selectClass}
              value={nextStatus}
              onChange={e => {
                const status = e.target.value as ApplicationStatus
                setNextStatus(status)
                setNote(DEFAULT_NOTE[status] || '')
              }}
            >
              {MANUAL_STATUSES.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </Field>
          <Field
            label="Note to the applicant"
            hint="Appears on their application tracker and in their notifications. Keep it plain."
          >
            <textarea rows={3} className={inputClass} value={note} onChange={e => setNote(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
