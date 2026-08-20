import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, MapPin, CheckCircle2, Send, Zap, Pencil, Archive, ExternalLink, Globe, Inbox, Lock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { ApplicationRow, Company, Job } from '../types'
import { Modal, Field, inputClass, selectClass } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useHeaderActions } from '../components/HeaderActions'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import {
  Alert, Avatar, Btn, Card, EmptyState, IconBtn, Loading, Pill, SearchInput, Tag, Toolbar,
  humanize, moneyK, stageTone,
} from '../components/ui'

const STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'LIVE', 'PAUSED', 'CLOSED', 'FILLED']

const emptyForm = {
  companyId: '', title: '', description: '', city: '', country: '', remote: false,
  remotePolicy: 'HYBRID', salaryMin: '', salaryMax: '', employmentType: 'FULL_TIME',
  visibility: 'PUBLIC', requirements: '', responsibilities: '', requiredSkills: '',
  niceToHaveSkills: '', requiresResume: false,
}

/** A posting reaches the careers site only when it is both LIVE and PUBLIC. */
const isOnPublicBoard = (job: Job) => job.status === 'LIVE' && job.visibility === 'PUBLIC'

type JobForm = typeof emptyForm

/** Existing posting → editable form values. */
function toForm(job: Job): JobForm {
  return {
    companyId: job.company?.id || '',
    title: job.title || '',
    description: job.description || '',
    city: job.location?.city || '',
    country: job.location?.country || '',
    remote: !!job.location?.remote,
    remotePolicy: job.remotePolicy || 'HYBRID',
    salaryMin: job.salaryMin != null ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax != null ? String(job.salaryMax) : '',
    employmentType: job.employmentType || 'FULL_TIME',
    visibility: job.visibility || 'PUBLIC',
    requirements: (job.requirements || []).join('\n'),
    responsibilities: (job.responsibilities || []).join('\n'),
    requiredSkills: (job.requiredSkills || []).map(s => `${s.name}:${s.level}`).join(', '),
    niceToHaveSkills: (job.niceToHaveSkills || []).map(s => `${s.name}:${s.level}`).join(', '),
    requiresResume: !!job.requiresResume,
  }
}

/** Parses "React:4, TypeScript:3" into the API's [{name, level}] shape. */
function parseSkills(input: string) {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(part => {
      const [name, level] = part.split(':').map(p => p.trim())
      const parsed = Number(level)
      return { name, level: Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 3 }
    })
}

/** Days since the posting was created — the number recruiters actually watch. */
const daysOpen = (createdAt: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))

export function JobsPage() {
  const { can } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [closingJob, setClosingJob] = useState<Job | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState<JobForm>(emptyForm)

  const canWrite = can(P.JOBS_WRITE)
  const canApprove = can(P.JOBS_APPROVE)
  const canCalculate = can(P.MATCHING_CALCULATE)
  const canClose = can(P.JOBS_CLOSE)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [jobsData, companyData] = await Promise.all([
        api.get<Job[]>('/jobs', { limit: 200 }),
        api.get<Company[]>('/companies', { limit: 200 }),
      ])
      setJobs(jobsData)
      setCompanies(companyData)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load jobs')
    }
    setLoading(false)
  }, [])

  // Applicant counts are a separate, non-blocking call: a recruiter without
  // candidates:read still gets the board, just without the tallies.
  useEffect(() => {
    api
      .get<ApplicationRow[]>('/applications', { limit: 500 })
      .then(setApplications)
      .catch(() => setApplications([]))
  }, [])

  /** Applications per job, and how many nobody has looked at yet. */
  const applicantCounts = useMemo(() => {
    const counts = new Map<string, { total: number; unread: number }>()
    for (const a of applications) {
      const jobId = a.job?.id
      if (!jobId) continue
      const entry = counts.get(jobId) || { total: 0, unread: 0 }
      entry.total += 1
      if (a.status === 'SUBMITTED') entry.unread += 1
      counts.set(jobId, entry)
    }
    return counts
  }, [applications])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  /**
   * Most roles sit where the client sits, so borrow the location off the record
   * rather than shipping a default country in the code. Only fills blanks — a
   * location already typed in is never overwritten.
   */
  const pickCompany = (companyId: string) => {
    const company = companies.find(c => c.id === companyId)
    setForm(f => ({
      ...f,
      companyId,
      city: f.city || company?.location?.city || '',
      country: f.country || company?.location?.country || '',
    }))
  }

  const openEdit = (job: Job) => {
    setEditing(job)
    setForm(toForm(job))
    setModalOpen(true)
  }

  useHeaderActions(
    canWrite ? (
      <Btn
        variant="primary"
        icon={<Plus className="h-4 w-4" />}
        onClick={openCreate}
        disabled={!companies.length}
        title={companies.length ? undefined : 'Add a company before posting a role'}
      >
        <span className="hidden sm:inline">Post a job</span>
        <span className="sm:hidden">New</span>
      </Btn>
    ) : null,
    [canWrite, companies.length],
  )

  const liveCount = jobs.filter(isOnPublicBoard).length
  const awaitingPublish = jobs.filter(j => j.status === 'APPROVED').length

  const filtered = jobs.filter(j => {
    const term = search.toLowerCase()
    const matchSearch = !term || j.title.toLowerCase().includes(term) || (j.company?.name || '').toLowerCase().includes(term)
    return matchSearch && (!statusFilter || j.status === statusFilter)
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        description: form.description,
        location: { city: form.city, country: form.country, remote: form.remote },
        remotePolicy: form.remotePolicy,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        employmentType: form.employmentType,
        visibility: form.visibility,
        requirements: form.requirements.split('\n').map(r => r.trim()).filter(Boolean),
        responsibilities: form.responsibilities.split('\n').map(r => r.trim()).filter(Boolean),
        requiredSkills: parseSkills(form.requiredSkills),
        niceToHaveSkills: parseSkills(form.niceToHaveSkills),
        requiresResume: form.requiresResume,
      }

      if (editing) {
        // The API does not accept companyId on update, and status moves through
        // the approve/publish endpoints — neither is sent from this form.
        const updated = await api.put<Job>(`/jobs/${editing.id}`, payload)
        setJobs(prev => prev.map(j => (j.id === editing.id ? { ...j, ...updated } : j)))
        setNotice(`${updated.title} updated.`)
      } else {
        await api.post('/jobs', { ...payload, companyId: form.companyId, status: 'PENDING_APPROVAL' })
        setNotice(`${form.title} created and sent for approval.`)
        await load()
      }
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Failed to ${editing ? 'update' : 'create'} job`)
    }
    setSaving(false)
  }

  /** The API closes a posting rather than deleting it, so history is preserved. */
  const confirmClose = async () => {
    if (!closingJob) return
    setRemoving(true)
    setError('')
    try {
      await api.delete(`/jobs/${closingJob.id}`)
      setJobs(prev => prev.map(j => (j.id === closingJob.id ? { ...j, status: 'CLOSED' } : j)))
      setNotice(`${closingJob.title} closed.`)
      setClosingJob(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to close job')
    }
    setRemoving(false)
  }

  const NOTICE: Record<string, string> = {
    approve: 'Job approved — it can now be published.',
    publish: 'Job is now live — public roles are on the careers site and open to applications.',
    submit: 'Sent to a manager for approval.',
  }

  const act = async (id: string, action: 'approve' | 'publish' | 'submit' | 'recalculate') => {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      if (action === 'recalculate') {
        const matches = await api.post<unknown[]>(`/matches/calculate/job/${id}`)
        setNotice(`Recalculated ${matches.length} match scores for this role.`)
      } else {
        const updated = await api.patch<Job>(`/jobs/${id}/${action}`)
        setJobs(prev => prev.map(j => (j.id === id ? { ...j, status: updated.status } : j)))
        setNotice(NOTICE[action])
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Failed to ${action} job`)
    }
    setBusyId(null)
  }

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {/* The board's own status line — a recruiter should never have to guess
          whether the outside world can see anything. */}
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-ink-700">
          <Globe className="h-4 w-4 text-success-600" />
          <span className="font-mono tnum font-medium text-ink-900">{liveCount}</span>
          {liveCount === 1 ? 'role is' : 'roles are'} open to applicants on the careers site
        </span>
        {awaitingPublish > 0 && (
          <span className="text-sm text-ink-500">
            <span className="font-mono tnum">{awaitingPublish}</span> approved and waiting to be published
          </span>
        )}
        <a
          href="/careers"
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View the careers site
        </a>
      </Card>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search role or company" className="max-w-md" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-auto">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <span className="ml-auto text-xs text-ink-500">
          {filtered.length} of {jobs.length}
        </span>
      </Toolbar>

      {loading ? (
        <Loading label="Loading jobs" />
      ) : filtered.length ? (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(job => {
            const days = daysOpen(job.createdAt)
            const busy = busyId === job.id
            const live = isOnPublicBoard(job)
            const applicants = applicantCounts.get(job.id) || { total: 0, unread: 0 }
            const showApprove = canApprove && ['DRAFT', 'PENDING_APPROVAL'].includes(job.status)
            const showPublish = canApprove && ['APPROVED', 'PAUSED'].includes(job.status)
            // Without jobs:approve, a draft can only be handed to a manager.
            const showSubmit = !canApprove && canWrite && job.status === 'DRAFT'
            return (
              <Card key={job.id} className="flex flex-col p-4 transition-colors duration-base ease-out hover:border-ink-300">
                <div className="flex items-start gap-3">
                  <Avatar name={job.company?.name || job.title} size={36} rounded="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-md font-semibold tracking-snug text-ink-900">{job.title}</h3>
                    <p className="truncate text-xs text-ink-500">{job.company?.name || 'Unassigned company'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {job.requiresResume && <Pill tone="info">CV</Pill>}
                    <Pill tone={stageTone(job.status)}>{humanize(job.status)}</Pill>
                    {canWrite && (
                      <IconBtn
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        label={`Edit ${job.title}`}
                        onClick={() => openEdit(job)}
                      />
                    )}
                    {canClose && job.status !== 'CLOSED' && (
                      <IconBtn
                        icon={<Archive className="h-3.5 w-3.5" />}
                        label={`Close ${job.title}`}
                        tone="danger"
                        onClick={() => setClosingJob(job)}
                      />
                    )}
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-600">{job.description}</p>

                {!!job.requiredSkills?.length && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {job.requiredSkills.slice(0, 4).map((s, i) => (
                      <Tag key={`${s.name}-${i}`}>{s.name}</Tag>
                    ))}
                    {job.requiredSkills.length > 4 && (
                      <span className="self-center text-2xs text-ink-400">+{job.requiredSkills.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-200 pt-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-ink-400" />
                    {job.location?.city || (job.location?.remote ? 'Remote' : '—')}
                  </span>
                  <span className="font-mono tnum text-ink-700">
                    {moneyK(job.salaryMin, job.currency)} – {moneyK(job.salaryMax, job.currency)}
                  </span>
                  <span>{humanize(job.employmentType)}</span>
                  <span className="ml-auto font-mono tnum text-ink-400">{days}d open</span>
                </div>

                {/* Where the role stands with the outside world. */}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  {live ? (
                    <a
                      href={`/careers/${job.slug || job.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-success-700 hover:text-success-800"
                    >
                      <Globe className="h-3.5 w-3.5" /> Live on the careers site
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : job.visibility === 'PUBLIC' ? (
                    <span className="inline-flex items-center gap-1.5 text-ink-500">
                      <Globe className="h-3.5 w-3.5 text-ink-400" />
                      {job.status === 'APPROVED'
                        ? 'Approved — publish to open it to applicants'
                        : 'Not yet on the careers site'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-ink-500">
                      <Lock className="h-3.5 w-3.5 text-ink-400" />
                      {humanize(job.visibility).toLowerCase()} — never listed publicly
                    </span>
                  )}

                  {applicants.total > 0 && (
                    <Link
                      to="/applications"
                      className="ml-auto inline-flex items-center gap-1.5 font-medium text-accent-600 hover:text-accent-700"
                    >
                      <Inbox className="h-3.5 w-3.5" />
                      <span className="font-mono tnum">{applicants.total}</span>
                      {applicants.total === 1 ? 'applicant' : 'applicants'}
                      {applicants.unread > 0 && (
                        <span className="font-mono tnum text-ink-500">({applicants.unread} new)</span>
                      )}
                    </Link>
                  )}
                </div>

                {(showApprove || showPublish || showSubmit || canCalculate) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-200 pt-3">
                    {showApprove && (
                      <Btn
                        size="sm"
                        onClick={() => act(job.id, 'approve')}
                        disabled={busy}
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      >
                        Approve
                      </Btn>
                    )}
                    {showPublish && (
                      <Btn
                        size="sm"
                        variant="dark"
                        onClick={() => act(job.id, 'publish')}
                        disabled={busy}
                        icon={<Send className="h-3.5 w-3.5" />}
                      >
                        Publish
                      </Btn>
                    )}
                    {showSubmit && (
                      <Btn
                        size="sm"
                        onClick={() => act(job.id, 'submit')}
                        disabled={busy}
                        icon={<Send className="h-3.5 w-3.5" />}
                      >
                        Submit for approval
                      </Btn>
                    )}
                    {canCalculate && (
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => act(job.id, 'recalculate')}
                        loading={busy}
                        icon={<Zap className="h-3.5 w-3.5" />}
                      >
                        Rescore matches
                      </Btn>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No jobs match these filters"
            hint={jobs.length ? 'Try a different status or search term.' : 'Post your first role to start matching talent.'}
            action={
              jobs.length ? (
                <Btn
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('')
                  }}
                >
                  Reset filters
                </Btn>
              ) : undefined
            }
          />
        </Card>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.title}` : 'Post a job'}
        description={
          editing
            ? 'The client and the approval status are not changed here — use the card actions for those.'
            : 'New postings enter the approval queue before they can go live.'
        }
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn form="job-form" type="submit" variant="primary" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create job'}
            </Btn>
          </>
        }
      >
        <form id="job-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Company" hint={editing ? 'A posting cannot be moved to another client.' : undefined}>
              {editing ? (
                <div className="flex h-[38px] items-center rounded-sm border border-ink-200 bg-ink-50 px-3 text-sm text-ink-600">
                  {editing.company?.name || 'Unassigned company'}
                </div>
              ) : (
                <select required className={selectClass} value={form.companyId} onChange={e => pickCompany(e.target.value)}>
                  <option value="">Select a company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Title">
              <input required className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea required rows={3} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Remote policy">
            <select
              className={selectClass}
              value={form.remotePolicy}
              onChange={e => setForm({ ...form, remotePolicy: e.target.value, remote: e.target.value !== 'ONSITE' })}
            >
              {['ONSITE', 'HYBRID', 'REMOTE'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Employment type">
            <select className={selectClass} value={form.employmentType} onChange={e => setForm({ ...form, employmentType: e.target.value })}>
              {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'].map(t => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </Field>
          <Field label="Salary min">
            <input type="number" min="0" className={inputClass} value={form.salaryMin} onChange={e => setForm({ ...form, salaryMin: e.target.value })} />
          </Field>
          <Field label="Salary max">
            <input type="number" min="0" className={inputClass} value={form.salaryMax} onChange={e => setForm({ ...form, salaryMax: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Required skills" hint="Comma separated with optional level 1-5, e.g. React:4, TypeScript:3">
              <input className={inputClass} value={form.requiredSkills} onChange={e => setForm({ ...form, requiredSkills: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Nice-to-have skills" hint="Same format — shown separately on the careers site">
              <input className={inputClass} value={form.niceToHaveSkills} onChange={e => setForm({ ...form, niceToHaveSkills: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Requirements" hint="One per line — published as “What we are looking for”">
              <textarea rows={3} className={inputClass} value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Responsibilities" hint="One per line — published as “What you will do”">
              <textarea rows={3} className={inputClass} value={form.responsibilities} onChange={e => setForm({ ...form, responsibilities: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Visibility"
              hint={
                form.visibility === 'PUBLIC'
                  ? 'Public roles appear on the careers site once they are published, and anyone can apply.'
                  : 'Only PUBLIC roles reach the careers site. This one stays internal however it is published.'
              }
            >
              <select className={selectClass} value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}>
                {['PUBLIC', 'PRIVATE', 'CONFIDENTIAL'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-ink-200 px-3 py-2.5
              transition-colors duration-base ease-out hover:border-ink-300">
              <input
                type="checkbox"
                checked={form.requiresResume}
                onChange={e => setForm({ ...form, requiresResume: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent-500"
              />
              <span>
                <span className="block text-sm font-medium text-ink-900">Require a CV</span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  The application form asks for a PDF or Word document and will not submit without
                  one. Leave off where a profile and a cover note are enough — every extra
                  requirement loses applicants.
                </span>
              </span>
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!closingJob}
        title={`Close ${closingJob?.title || 'this role'}?`}
        message="The posting moves to CLOSED and stops appearing to candidates. It is not deleted — existing matches, applications and placements are kept, and a manager can reopen it by changing the status."
        confirmLabel="Close job"
        tone="warning"
        loading={removing}
        onConfirm={confirmClose}
        onCancel={() => setClosingJob(null)}
      />
    </div>
  )
}
