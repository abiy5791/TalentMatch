import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, BadgeCheck, ShieldCheck, Loader2, Pencil, Trash2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Candidate } from '../types'
import { Modal, Field, inputClass, selectClass } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useHeaderActions } from '../components/HeaderActions'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import {
  Alert, Avatar, Btn, Card, EmptyState, IconBtn, Loading, SearchInput, StatusSelect, Tag, Toolbar, humanize, moneyK,
} from '../components/ui'

const STATUSES = [
  'UNASSIGNED', 'SCREENING', 'MATCHED', 'SENT_TO_COMPANY',
  'INTERVIEWING', 'OFFERED', 'PLACED', 'ARCHIVED',
]

const emptyForm = {
  firstName: '', lastName: '', email: '', phone: '', currentTitle: '', currentCompany: '',
  city: '', country: '', experienceYears: '', salaryExpectationMin: '', salaryExpectationMax: '',
  availability: 'IMMEDIATE', skills: '',
}

type CandidateForm = typeof emptyForm

/** Existing record → editable form values. */
function toForm(c: Candidate): CandidateForm {
  return {
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    email: c.email || '',
    phone: c.phone || '',
    currentTitle: c.currentTitle || '',
    currentCompany: c.currentCompany || '',
    city: c.location?.city || '',
    country: c.location?.country || '',
    experienceYears: c.experienceYears != null ? String(c.experienceYears) : '',
    salaryExpectationMin: c.salaryExpectationMin != null ? String(c.salaryExpectationMin) : '',
    salaryExpectationMax: c.salaryExpectationMax != null ? String(c.salaryExpectationMax) : '',
    availability: c.availability || 'IMMEDIATE',
    skills: (c.skills || []).map(s => s.skillName).join(', '),
  }
}

const salaryBand = (c: Candidate) =>
  c.salaryExpectationMin
    ? `${moneyK(c.salaryExpectationMin, c.currency)} – ${moneyK(c.salaryExpectationMax, c.currency)}`
    : '—'

export function CandidatesPage() {
  const { can } = useAuth()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [deleting, setDeleting] = useState<Candidate | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [form, setForm] = useState<CandidateForm>(emptyForm)
  const [busyId, setBusyId] = useState<string | null>(null)

  const canWrite = can(P.CANDIDATES_WRITE)
  const canVerify = can(P.CANDIDATES_VERIFY)
  const canDelete = can(P.CANDIDATES_DELETE)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCandidates(await api.get<Candidate[]>('/candidates', { limit: 200 }))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load candidates')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (c: Candidate) => {
    setEditing(c)
    setForm(toForm(c))
    setModalOpen(true)
  }

  useHeaderActions(
    canWrite ? (
      <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
        <span className="hidden sm:inline">Add candidate</span>
        <span className="sm:hidden">New</span>
      </Btn>
    ) : null,
    [canWrite],
  )

  const filtered = candidates.filter(c => {
    const term = search.toLowerCase()
    const matchSearch =
      !term ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.currentTitle || '').toLowerCase().includes(term)
    return matchSearch && (!statusFilter || c.status === statusFilter)
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      // The API replaces the whole skill set, so carry each existing skill's
      // proficiency and experience across rather than resetting them to the
      // default for every name that was already on the profile.
      const existing = new Map((editing?.skills || []).map(s => [s.skillName.toLowerCase(), s]))
      const skills = form.skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(skillName => {
          const prior = existing.get(skillName.toLowerCase())
          return {
            skillName,
            proficiencyLevel: prior?.proficiencyLevel ?? 3,
            ...(prior?.category ? { category: prior.category } : {}),
            ...(prior?.yearsOfExperience != null ? { yearsOfExperience: prior.yearsOfExperience } : {}),
            ...(prior?.isPrimary != null ? { isPrimary: prior.isPrimary } : {}),
          }
        })

      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        currentTitle: form.currentTitle || undefined,
        currentCompany: form.currentCompany || undefined,
        location: form.city || form.country ? { city: form.city, country: form.country } : undefined,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        salaryExpectationMin: form.salaryExpectationMin ? Number(form.salaryExpectationMin) : undefined,
        salaryExpectationMax: form.salaryExpectationMax ? Number(form.salaryExpectationMax) : undefined,
        availability: form.availability,
        skills,
      }

      if (editing) {
        // Email is immutable on the API, and stage moves through the status
        // endpoint so the transition lands in the audit trail.
        const updated = await api.put<Candidate>(`/candidates/${editing.id}`, payload)
        setCandidates(prev => prev.map(c => (c.id === editing.id ? { ...c, ...updated } : c)))
        setNotice(`${updated.firstName} ${updated.lastName} updated.`)
      } else {
        await api.post('/candidates', { ...payload, email: form.email })
        setNotice(`${form.firstName} ${form.lastName} added.`)
        await load()
      }
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Failed to ${editing ? 'update' : 'create'} candidate`)
    }
    setSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    setError('')
    try {
      await api.delete(`/candidates/${deleting.id}`)
      setCandidates(prev => prev.filter(c => c.id !== deleting.id))
      setNotice(`${deleting.firstName} ${deleting.lastName} deleted.`)
      setDeleting(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete candidate')
    }
    setRemoving(false)
  }

  const changeStatus = async (id: string, status: string) => {
    setBusyId(id)
    try {
      const updated = await api.patch<Candidate>(`/candidates/${id}/status`, { status })
      setCandidates(prev => prev.map(c => (c.id === id ? { ...c, status: updated.status } : c)))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update status')
    }
    setBusyId(null)
  }

  const toggleVerified = async (c: Candidate) => {
    setBusyId(c.id)
    try {
      const next = !c.verifiedFlags?.identity
      const updated = await api.patch<Candidate>(`/candidates/${c.id}/verify`, { flags: { identity: next } })
      setCandidates(prev => prev.map(x => (x.id === c.id ? { ...x, verifiedFlags: updated.verifiedFlags } : x)))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update verification')
    }
    setBusyId(null)
  }

  // Rendered in both the table and the small-screen card list, so the two
  // layouts can never drift apart.
  const stageControl = (c: Candidate) => (
    <StatusSelect
      value={c.status}
      options={STATUSES}
      onChange={status => changeStatus(c.id, status)}
      disabled={!canWrite || busyId === c.id}
    />
  )

  const verifyControl = (c: Candidate, verified: boolean) =>
    canVerify ? (
      <button
        onClick={() => toggleVerified(c)}
        disabled={busyId === c.id}
        title={verified ? 'Identity verified — click to clear' : 'Mark identity verified'}
        aria-label={verified ? `Clear identity verification for ${c.firstName} ${c.lastName}` : `Mark ${c.firstName} ${c.lastName} identity verified`}
        className={`shrink-0 rounded-sm p-1 transition-colors duration-base ease-out
          hover:bg-ink-100 disabled:opacity-50
          ${verified ? 'text-success-500' : 'text-ink-300 hover:text-ink-500'}`}
      >
        {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
      </button>
    ) : null

  const rowActions = (c: Candidate, name: string) =>
    canWrite || canDelete ? (
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {canWrite && (
          <IconBtn icon={<Pencil className="h-3.5 w-3.5" />} label={`Edit ${name}`} onClick={() => openEdit(c)} />
        )}
        {canDelete && (
          <IconBtn
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={`Delete ${name}`}
            tone="danger"
            onClick={() => setDeleting(c)}
          />
        )}
      </div>
    ) : null

  const skillTags = (c: Candidate) => (
    <>
      {c.skills?.slice(0, 3).map(s => (
        <Tag key={s.skillName}>{s.skillName}</Tag>
      ))}
      {(c.skills?.length || 0) > 3 && (
        <span className="self-center text-2xs text-ink-400">+{(c.skills?.length || 0) - 3}</span>
      )}
    </>
  )

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email or current title"
          className="max-w-md"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-auto">
          <option value="">All stages</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </select>
      </Toolbar>

      {loading ? (
        <Loading label="Loading candidates" />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-ink-50 px-4 py-2.5">
            <span className="eyebrow">
              {filtered.length} {filtered.length === 1 ? 'candidate' : 'candidates'}
            </span>
            {candidates.length !== filtered.length && (
              <span className="text-xs text-ink-500">Filtered from {candidates.length}</span>
            )}
          </div>

          {filtered.length ? (
            <>
              {/* The full table needs ~860px of room. Below that it would push
                  the stage control and row actions off-screen behind a
                  horizontal scroll, so narrow viewports get cards instead. */}
              <div className="divide-y divide-ink-200 lg:hidden">
                {filtered.map(c => {
                  const name = `${c.firstName} ${c.lastName}`
                  const verified = !!c.verifiedFlags?.identity
                  return (
                    <div key={c.id} className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 font-medium text-ink-900">
                            <span className="truncate">{name}</span>
                            {verified && <BadgeCheck className="h-4 w-4 shrink-0 text-success-500" />}
                          </p>
                          <p className="truncate font-mono text-2xs text-ink-400">{c.email}</p>
                          <p className="mt-1 truncate text-xs text-ink-600">
                            {c.currentTitle || 'Role not set'}
                            {c.currentCompany ? ` · ${c.currentCompany}` : ''}
                          </p>
                        </div>
                        {rowActions(c, name)}
                      </div>

                      {!!c.skills?.length && (
                        <div className="mt-2.5 flex flex-wrap gap-1">{skillTags(c)}</div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-200 pt-3">
                        <span className="font-mono text-2xs tnum text-ink-500">
                          {c.experienceYears ? `${c.experienceYears} yrs` : 'Exp. not set'}
                        </span>
                        <span className="font-mono text-2xs tnum text-ink-700">{salaryBand(c)}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {stageControl(c)}
                          {verifyControl(c, verified)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-ink-200 bg-white">
                  <tr>
                    <th className="th">Candidate</th>
                    <th className="th">Current role</th>
                    <th className="th hidden xl:table-cell">Skills</th>
                    <th className="th text-right">Exp.</th>
                    <th className="th hidden text-right xl:table-cell">Expectation</th>
                    <th className="th">Stage</th>
                    {(canWrite || canDelete) && <th className="th text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200">
                  {filtered.map(c => {
                    const name = `${c.firstName} ${c.lastName}`
                    const verified = !!c.verifiedFlags?.identity
                    return (
                      <tr key={c.id} className="transition-colors duration-base ease-out hover:bg-ink-50">
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <Avatar name={name} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 font-medium text-ink-900">
                                <span className="truncate">{name}</span>
                                {verified && <BadgeCheck className="h-4 w-4 shrink-0 text-success-500" />}
                              </p>
                              <p className="truncate font-mono text-2xs text-ink-400">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="td">
                          <p className="text-ink-700">{c.currentTitle || '—'}</p>
                          {c.currentCompany && <p className="text-2xs text-ink-500">{c.currentCompany}</p>}
                        </td>
                        <td className="td hidden xl:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {skillTags(c)}
                            {!c.skills?.length && <span className="text-ink-400">—</span>}
                          </div>
                        </td>
                        <td className="td text-right font-mono text-xs tnum">
                          {c.experienceYears ? `${c.experienceYears} yrs` : '—'}
                        </td>
                        <td className="td hidden whitespace-nowrap text-right font-mono text-xs tnum xl:table-cell">
                          {salaryBand(c)}
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-2">
                            {stageControl(c)}
                            {verifyControl(c, verified)}
                          </div>
                        </td>
                        {(canWrite || canDelete) && <td className="td">{rowActions(c, name)}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <EmptyState
              title="No candidates match these filters"
              hint="Clear the stage filter or widen your search."
              action={
                <Btn
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('')
                  }}
                >
                  Reset filters
                </Btn>
              }
            />
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : 'Add candidate'}
        description={
          editing
            ? 'Pipeline stage is changed in the table so the move is recorded in the audit trail.'
            : 'Creates the profile and its first pipeline entry.'
        }
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn form="candidate-form" type="submit" variant="primary" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create candidate'}
            </Btn>
          </>
        }
      >
        <form id="candidate-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <input required className={inputClass} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input required className={inputClass} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Email" hint={editing ? 'Email is the profile identifier and cannot be changed.' : undefined}>
            {editing ? (
              <div className="flex h-[38px] items-center rounded-sm border border-ink-200 bg-ink-50 px-3 font-mono text-xs text-ink-600">
                {editing.email}
              </div>
            ) : (
              <input required type="email" className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            )}
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Current title">
            <input className={inputClass} value={form.currentTitle} onChange={e => setForm({ ...form, currentTitle: e.target.value })} />
          </Field>
          <Field label="Current company">
            <input className={inputClass} value={form.currentCompany} onChange={e => setForm({ ...form, currentCompany: e.target.value })} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Years of experience">
            <input type="number" min="0" className={inputClass} value={form.experienceYears} onChange={e => setForm({ ...form, experienceYears: e.target.value })} />
          </Field>
          <Field label="Availability">
            <select className={selectClass} value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })}>
              {['IMMEDIATE', 'ONE_WEEK', 'TWO_WEEKS', 'ONE_MONTH', 'TWO_MONTHS'].map(a => (
                <option key={a} value={a}>{humanize(a)}</option>
              ))}
            </select>
          </Field>
          <Field label="Salary expectation min">
            <input type="number" min="0" className={inputClass} value={form.salaryExpectationMin} onChange={e => setForm({ ...form, salaryExpectationMin: e.target.value })} />
          </Field>
          <Field label="Salary expectation max">
            <input type="number" min="0" className={inputClass} value={form.salaryExpectationMax} onChange={e => setForm({ ...form, salaryExpectationMax: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Skills" hint="Comma separated, e.g. React, TypeScript, Node.js">
              <input className={inputClass} value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.firstName || ''} ${deleting?.lastName || ''}`.trim() + '?'}
        message="This permanently removes the candidate profile, their skills and their pipeline history. Match scores and any placement already recorded against them are kept. This cannot be undone."
        confirmLabel="Delete candidate"
        loading={removing}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
