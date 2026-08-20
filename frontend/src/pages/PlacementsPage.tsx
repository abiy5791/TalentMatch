import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, Star, Pencil, Trash2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Candidate, Company, Job, Placement } from '../types'
import { Modal, Field, inputClass, selectClass } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useHeaderActions } from '../components/HeaderActions'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import {
  Alert, Avatar, Btn, Card, EmptyState, IconBtn, Loading, StatCard, StatusSelect, humanize, money, moneyK,
} from '../components/ui'

const STATUSES = ['ACTIVE', 'COMPLETED', 'TERMINATED']

const emptyForm = { candidateId: '', jobId: '', startDate: '', salaryOffered: '', feePercentage: '20' }

type PlacementForm = typeof emptyForm

/** Existing record -> editable form values. */
function toForm(p: Placement): PlacementForm {
  return {
    candidateId: p.candidate?.id || '',
    jobId: p.job?.id || '',
    startDate: p.startDate ? p.startDate.slice(0, 10) : '',
    salaryOffered: p.salaryOffered != null ? String(p.salaryOffered) : '',
    feePercentage: p.feePercentage != null ? String(p.feePercentage) : '20',
  }
}

export function PlacementsPage() {
  const { can } = useAuth()
  const [placements, setPlacements] = useState<Placement[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Placement | null>(null)
  const [deleting, setDeleting] = useState<Placement | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [form, setForm] = useState<PlacementForm>(emptyForm)

  const canWrite = can(P.PLACEMENTS_WRITE)
  const canDelete = can(P.PLACEMENTS_DELETE)
  // Fee and salary are stripped from the API response without this permission.
  const canSeeFinancials = can(P.ANALYTICS_FINANCIALS)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [placementData, candidateData, jobData] = await Promise.all([
        api.get<Placement[]>('/placements', { limit: 200 }),
        api.get<Candidate[]>('/candidates', { limit: 200 }),
        api.get<Job[]>('/jobs', { limit: 200 }),
      ])
      setPlacements(placementData)
      setCandidates(candidateData)
      setJobs(jobData)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load placements')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (p: Placement) => {
    setEditing(p)
    setForm(toForm(p))
    setModalOpen(true)
  }

  useHeaderActions(
    canWrite ? (
      <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
        <span className="hidden sm:inline">Record placement</span>
        <span className="sm:hidden">New</span>
      </Btn>
    ) : null,
    [canWrite],
  )

  const selectedJob = jobs.find(j => j.id === form.jobId)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (editing) {
      // Candidate, job and client are fixed once a placement exists — only the
      // commercial terms and dates can be corrected. The fee is recalculated
      // server-side from salary x percentage.
      setSaving(true)
      try {
        const updated = await api.put<Placement>(`/placements/${editing.id}`, {
          startDate: form.startDate || undefined,
          salaryOffered: form.salaryOffered ? Number(form.salaryOffered) : undefined,
          feePercentage: form.feePercentage ? Number(form.feePercentage) : undefined,
        })
        setPlacements(prev => prev.map(p => (p.id === editing.id ? { ...p, ...updated } : p)))
        setNotice('Placement updated.')
        setModalOpen(false)
        setEditing(null)
        setForm(emptyForm)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to update placement')
      }
      setSaving(false)
      return
    }

    const company: Company | undefined = selectedJob?.company
    if (!company) { setError('Selected job has no company'); return }
    setSaving(true)
    try {
      await api.post('/placements', {
        candidateId: form.candidateId,
        jobId: form.jobId,
        companyId: company.id,
        startDate: form.startDate || undefined,
        salaryOffered: form.salaryOffered ? Number(form.salaryOffered) : undefined,
        feePercentage: form.feePercentage ? Number(form.feePercentage) : undefined,
      })
      setNotice('Placement recorded.')
      setModalOpen(false)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to record placement')
    }
    setSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    setError('')
    try {
      await api.delete(`/placements/${deleting.id}`)
      setPlacements(prev => prev.filter(p => p.id !== deleting.id))
      setNotice('Placement deleted.')
      setDeleting(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete placement')
    }
    setRemoving(false)
  }

  const rate = async (placement: Placement, score: number) => {
    try {
      const updated = await api.patch<Placement>(`/placements/${placement.id}/feedback`, { satisfactionScore: score })
      setPlacements(prev => prev.map(p => (p.id === placement.id ? { ...p, satisfactionScore: updated.satisfactionScore } : p)))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save feedback')
    }
  }

  const changeStatus = async (placement: Placement, status: string) => {
    try {
      const updated = await api.put<Placement>(`/placements/${placement.id}`, { status })
      setPlacements(prev => prev.map(p => (p.id === placement.id ? { ...p, status: updated.status } : p)))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update placement')
    }
  }

  const totalFees = placements.reduce((sum, p) => sum + (Number(p.placementFee) || 0), 0)
  // Fees are summed across placements, so the total is only meaningful in one
  // currency — take it from the roles behind them rather than assuming.
  const feeCurrency = placements.find(p => p.job?.currency)?.job?.currency
  const activeCount = placements.filter(p => p.status === 'ACTIVE').length
  const rated = placements.filter(p => p.satisfactionScore)
  const avgSatisfaction = rated.length
    ? (rated.reduce((sum, p) => sum + (p.satisfactionScore || 0), 0) / rated.length).toFixed(1)
    : '—'

  // Shared by the table and the small-screen card list.
  const statusControl = (p: Placement) => (
    <StatusSelect
      value={p.status}
      options={STATUSES}
      onChange={status => changeStatus(p, status)}
      disabled={!canWrite}
    />
  )

  const stars = (p: Placement) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => rate(p, n)}
          disabled={!canWrite}
          title={canWrite ? `Rate ${n}/5` : `Rated ${p.satisfactionScore || 0}/5`}
          aria-label={`Rate ${n} of 5`}
          className="disabled:cursor-default"
        >
          <Star
            className={`h-4 w-4 transition-colors duration-base ease-out ${
              (p.satisfactionScore || 0) >= n ? 'fill-warning-500 text-warning-500' : 'text-ink-300'
            }`}
          />
        </button>
      ))}
    </div>
  )

  const rowActions = (p: Placement, name: string) =>
    canWrite || canDelete ? (
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {canWrite && (
          <IconBtn
            icon={<Pencil className="h-3.5 w-3.5" />}
            label={`Edit placement for ${name}`}
            onClick={() => openEdit(p)}
          />
        )}
        {canDelete && (
          <IconBtn
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={`Delete placement for ${name}`}
            tone="danger"
            onClick={() => setDeleting(p)}
          />
        )}
      </div>
    ) : null

  const placementName = (p: Placement) =>
    `${p.candidate?.firstName || ''} ${p.candidate?.lastName || ''}`.trim() || 'Unknown candidate'

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Placements" value={placements.length} note={`${activeCount} currently active`} />
        {canSeeFinancials ? (
          <StatCard label="Fees booked" value={moneyK(totalFees, feeCurrency)} note="Sum of recorded placement fees" />
        ) : (
          <StatCard label="Active" value={activeCount} note="Placements currently running" />
        )}
        <StatCard label="Satisfaction" value={avgSatisfaction} unit={rated.length ? '/ 5' : ''} note={`${rated.length} rated`} />
      </div>

      {loading ? (
        <Loading label="Loading placements" />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-ink-50 px-4 py-2.5">
            <span className="eyebrow">Placement record</span>
            <span className="text-xs text-ink-500">Fee is calculated from salary × fee %</span>
          </div>

          {placements.length ? (
            <>
              {/* Narrow viewports get cards: the full table would push the
                  status control and row actions behind a horizontal scroll. */}
              <div className="divide-y divide-ink-200 lg:hidden">
                {placements.map(p => {
                  const name = placementName(p)
                  return (
                    <div key={p.id} className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink-900">{name}</p>
                          <p className="truncate text-2xs text-ink-500">
                            {p.job?.title} · {p.company?.name}
                          </p>
                        </div>
                        {rowActions(p, name)}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-200 pt-3">
                        <span className="font-mono text-2xs tnum text-ink-500">
                          {p.startDate ? `Starts ${new Date(p.startDate).toLocaleDateString()}` : 'No start date'}
                        </span>
                        {canSeeFinancials && (
                          <span className="font-mono text-2xs tnum text-ink-700">
                            {money(p.salaryOffered, p.job?.currency)}
                            <span className="text-ink-400"> · fee {money(p.placementFee, p.job?.currency)}</span>
                          </span>
                        )}
                        {statusControl(p)}
                        <div className="ml-auto">{stars(p)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-ink-200 bg-white">
                  <tr>
                    <th className="th">Placement</th>
                    <th className="th hidden xl:table-cell">Start date</th>
                    {canSeeFinancials && <th className="th hidden text-right xl:table-cell">Salary</th>}
                    {canSeeFinancials && <th className="th text-right">Fee</th>}
                    <th className="th">Status</th>
                    <th className="th">Satisfaction</th>
                    {(canWrite || canDelete) && <th className="th text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200">
                  {placements.map(p => {
                    const name = `${p.candidate?.firstName || ''} ${p.candidate?.lastName || ''}`.trim() || 'Unknown candidate'
                    return (
                      <tr key={p.id} className="transition-colors duration-base ease-out hover:bg-ink-50">
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <Avatar name={name} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink-900">{name}</p>
                              <p className="truncate text-2xs text-ink-500">
                                {p.job?.title} · {p.company?.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="td hidden whitespace-nowrap font-mono text-xs tnum xl:table-cell">
                          {p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'}
                        </td>
                        {canSeeFinancials && (
                          <td className="td hidden text-right font-mono text-xs tnum xl:table-cell">
                            {money(p.salaryOffered, p.job?.currency)}
                          </td>
                        )}
                        {canSeeFinancials && (
                          <td className="td whitespace-nowrap text-right">
                            <span className="font-mono text-xs tnum text-ink-900">{money(p.placementFee, p.job?.currency)}</span>
                            {p.feePercentage ? (
                              <span className="ml-1.5 text-2xs text-ink-400">{p.feePercentage}%</span>
                            ) : null}
                          </td>
                        )}
                        <td className="td">{statusControl(p)}</td>
                        <td className="td">{stars(p)}</td>
                        {(canWrite || canDelete) && <td className="td">{rowActions(p, name)}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <EmptyState
              title="No placements recorded yet"
              hint="Record a placement once a candidate signs — the fee and pipeline stage update automatically."
              action={
                canWrite ? (
                  <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
                    Record placement
                  </Btn>
                ) : undefined
              }
            />
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit placement' : 'Record placement'}
        description={
          editing
            ? 'Candidate, role and client are fixed once a placement exists — only terms and dates can be corrected.'
            : 'Marks the candidate PLACED and the job FILLED.'
        }
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn form="placement-form" type="submit" variant="primary" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Record placement'}
            </Btn>
          </>
        }
      >
        <form id="placement-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Candidate">
              {editing ? (
                <div className="flex h-[38px] items-center rounded-sm border border-ink-200 bg-ink-50 px-3 text-sm text-ink-600">
                  {editing.candidate?.firstName} {editing.candidate?.lastName}
                </div>
              ) : (
                <select required className={selectClass} value={form.candidateId} onChange={e => setForm({ ...form, candidateId: e.target.value })}>
                  <option value="">Select a candidate…</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} — {humanize(c.status)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Job">
              {editing ? (
                <div className="flex h-[38px] items-center rounded-sm border border-ink-200 bg-ink-50 px-3 text-sm text-ink-600">
                  {editing.job?.title} — {editing.company?.name}
                </div>
              ) : (
                <select required className={selectClass} value={form.jobId} onChange={e => setForm({ ...form, jobId: e.target.value })}>
                  <option value="">Select a job…</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company?.name}</option>)}
                </select>
              )}
            </Field>
          </div>
          <Field label="Start date">
            <input type="date" className={inputClass} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Salary offered">
            <input type="number" min="0" className={inputClass} value={form.salaryOffered} onChange={e => setForm({ ...form, salaryOffered: e.target.value })} />
          </Field>
          <Field label="Fee percentage" hint="Placement fee is calculated from salary × fee %.">
            <input type="number" min="0" max="100" step="0.5" className={inputClass} value={form.feePercentage} onChange={e => setForm({ ...form, feePercentage: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this placement?"
        message={
          <>
            This permanently removes the placement record for{' '}
            <span className="font-medium text-ink-900">
              {deleting?.candidate?.firstName} {deleting?.candidate?.lastName}
            </span>{' '}
            and its fee from reporting. The candidate and the role are not changed. This cannot be undone.
          </>
        }
        confirmLabel="Delete placement"
        loading={removing}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
