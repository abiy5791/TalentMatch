import { FormEvent, useCallback, useEffect, useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { PERMISSIONS as P } from '../../lib/permissions'
import { PortalJob } from '../../types'
import { Modal, Field, inputClass, selectClass } from '../../components/Modal'
import { useHeaderActions } from '../../components/HeaderActions'
import {
  Alert, Btn, Card, EmptyState, Loading, Pill, Tag, humanize, moneyK, stageTone,
} from '../../components/ui'

const emptyForm = {
  title: '', description: '', city: '', country: '', remotePolicy: 'HYBRID',
  employmentType: 'FULL_TIME', salaryMin: '', salaryMax: '', requiredSkills: '',
}

/** "React:4, TypeScript:3" → [{name, level}] */
function parseSkills(input: string) {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(part => {
      const [name, level] = part.split(':').map(x => x.trim())
      const parsed = Number(level)
      return { name, level: Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 3 }
    })
}

export function PortalRolesPage() {
  const { can } = useAuth()
  const canRequest = can(P.PORTAL_JOBS_REQUEST)
  const [jobs, setJobs] = useState<PortalJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // The employer's own record supplies the default location for a request,
      // so the form is not shipping a country that has to be corrected.
      const [list, company] = await Promise.all([
        api.get<PortalJob[]>('/portal/jobs'),
        api.get<{ location?: { city?: string; country?: string } }>('/portal/company').catch(() => null),
      ])
      setJobs(list)
      setForm(f => ({
        ...f,
        city: f.city || company?.location?.city || '',
        country: f.country || company?.location?.country || '',
      }))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load your roles')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useHeaderActions(
    canRequest ? (
      <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
        <span className="hidden sm:inline">Request a role</span>
        <span className="sm:hidden">Request</span>
      </Btn>
    ) : null,
    [canRequest],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/portal/jobs/request', {
        title: form.title,
        description: form.description,
        location: { city: form.city, country: form.country, remote: form.remotePolicy !== 'ONSITE' },
        remotePolicy: form.remotePolicy,
        employmentType: form.employmentType,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        requiredSkills: parseSkills(form.requiredSkills),
      })
      setNotice('Request sent — your account manager will confirm the brief before it goes live.')
      setModalOpen(false)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send your request')
    }
    setSaving(false)
  }

  if (loading) return <Loading label="Loading your roles" />

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {jobs.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map(job => (
            <Card key={job.id} className="overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-ink-200 px-4 py-3.5">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-ink-900">{job.title}</h2>
                  <p className="mt-0.5 text-xs text-ink-500">{humanize(job.employmentType)}</p>
                </div>
                <Pill tone={stageTone(job.status)}>{humanize(job.status)}</Pill>
              </div>

              <div className="space-y-3 px-4 py-3.5">
                <p className="line-clamp-2 text-xs text-ink-600">{job.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.requiredSkills?.slice(0, 5).map((s, i) => <Tag key={i}>{s.name}</Tag>)}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {job.location?.city || 'Remote'}
                  </span>
                  <span className="font-mono tnum">
                    {moneyK(job.salaryMin, job.currency)} – {moneyK(job.salaryMax, job.currency)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-ink-200 bg-ink-50 px-4 py-2.5 text-xs">
                <span className="text-ink-500">{job.submitted} submitted</span>
                {job.awaitingReview > 0 && (
                  <Pill tone="warning">{job.awaitingReview} to review</Pill>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No roles yet"
          hint={canRequest ? 'Use “Request a role” to brief your account manager.' : 'Your account manager will add roles here.'}
        />
      )}

      <Modal
        open={modalOpen}
        title="Request a role"
        description="Sends a brief to your account manager. They confirm the detail before it goes live."
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn form="role-form" type="submit" variant="primary" loading={saving}>
              {saving ? 'Sending…' : 'Send request'}
            </Btn>
          </>
        }
      >
        <form id="role-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Role title">
              <input required className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="What you need" hint="Responsibilities, team, must-haves">
              <textarea required rows={4} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Working pattern">
            <select className={selectClass} value={form.remotePolicy} onChange={e => setForm({ ...form, remotePolicy: e.target.value })}>
              {['ONSITE', 'HYBRID', 'REMOTE'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Employment type">
            <select className={selectClass} value={form.employmentType} onChange={e => setForm({ ...form, employmentType: e.target.value })}>
              {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'].map(v => (
                <option key={v} value={v}>{humanize(v)}</option>
              ))}
            </select>
          </Field>
          <Field label="Budget from">
            <input type="number" min="0" className={inputClass} value={form.salaryMin} onChange={e => setForm({ ...form, salaryMin: e.target.value })} />
          </Field>
          <Field label="Budget to">
            <input type="number" min="0" className={inputClass} value={form.salaryMax} onChange={e => setForm({ ...form, salaryMax: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Key skills" hint="Comma separated, optional level 1-5 — e.g. React:4, TypeScript:3">
              <input className={inputClass} value={form.requiredSkills} onChange={e => setForm({ ...form, requiredSkills: e.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  )
}
