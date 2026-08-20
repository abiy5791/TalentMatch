import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, ExternalLink, MapPin, Users2, Pencil, Trash2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Company } from '../types'
import { Modal, Field, inputClass, selectClass } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useHeaderActions } from '../components/HeaderActions'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import {
  Alert, Avatar, Btn, Card, EmptyState, IconBtn, Loading, Pill, SearchInput, StatusSelect, Tag, Toolbar,
} from '../components/ui'
import type { Tone } from '../components/ui'

const STATUSES = ['LEAD', 'ONBOARDED', 'ACTIVE', 'FULFILLED', 'INACTIVE']
const TIERS = ['STANDARD', 'VIP', 'RETAINER']
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

const TIER_TONE: Record<string, Tone> = {
  STANDARD: 'neutral',
  VIP: 'accent',
  RETAINER: 'success',
}

const emptyForm = {
  name: '', industry: '', size: '51-200', city: '', country: '', website: '',
  description: '', cultureTags: '', tier: 'STANDARD', status: 'LEAD',
}

type CompanyForm = typeof emptyForm

/** Existing record → editable form values. */
function toForm(c: Company): CompanyForm {
  return {
    name: c.name || '',
    industry: c.industry || '',
    size: c.size || '51-200',
    city: c.location?.city || '',
    country: c.location?.country || '',
    website: c.website || '',
    description: c.description || '',
    cultureTags: (c.cultureTags || []).join(', '),
    tier: c.tier || 'STANDARD',
    status: c.status || 'LEAD',
  }
}

export function CompaniesPage() {
  const { can } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [form, setForm] = useState<CompanyForm>(emptyForm)

  const canWrite = can(P.COMPANIES_WRITE)
  const canDelete = can(P.COMPANIES_DELETE)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCompanies(await api.get<Company[]>('/companies', { limit: 200 }))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load companies')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (c: Company) => {
    setEditing(c)
    setForm(toForm(c))
    setModalOpen(true)
  }

  useHeaderActions(
    canWrite ? (
      <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
        <span className="hidden sm:inline">Add company</span>
        <span className="sm:hidden">New</span>
      </Btn>
    ) : null,
    [canWrite],
  )

  const filtered = companies.filter(c => {
    const term = search.toLowerCase()
    const matchSearch = !term || c.name.toLowerCase().includes(term) || (c.industry || '').toLowerCase().includes(term)
    return matchSearch && (!statusFilter || c.status === statusFilter) && (!tierFilter || c.tier === tierFilter)
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        industry: form.industry || undefined,
        size: form.size,
        location: form.city || form.country ? { city: form.city, country: form.country } : undefined,
        website: form.website || undefined,
        description: form.description || undefined,
        cultureTags: form.cultureTags.split(',').map(t => t.trim()).filter(Boolean),
        tier: form.tier,
      }

      if (editing) {
        // Pipeline stage is deliberately not sent here — it moves through the
        // status endpoint, which records the transition in the audit trail.
        const updated = await api.put<Company>(`/companies/${editing.id}`, payload)
        setCompanies(prev => prev.map(c => (c.id === editing.id ? { ...c, ...updated } : c)))
        setNotice(`${updated.name} updated.`)
      } else {
        await api.post('/companies', { ...payload, status: form.status })
        setNotice(`${form.name} added.`)
        await load()
      }
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Failed to ${editing ? 'update' : 'create'} company`)
    }
    setSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    setError('')
    try {
      await api.delete(`/companies/${deleting.id}`)
      setCompanies(prev => prev.filter(c => c.id !== deleting.id))
      setNotice(`${deleting.name} deleted.`)
      setDeleting(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete company')
    }
    setRemoving(false)
  }

  const changeStatus = async (id: string, status: string) => {
    try {
      const updated = await api.patch<Company>(`/companies/${id}/status`, { status })
      setCompanies(prev => prev.map(c => (c.id === id ? { ...c, status: updated.status } : c)))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update status')
    }
  }

  const changeTier = async (id: string, tier: string) => {
    try {
      const updated = await api.put<Company>(`/companies/${id}`, { tier })
      setCompanies(prev => prev.map(c => (c.id === id ? { ...c, tier: updated.tier } : c)))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update tier')
    }
  }

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search company or industry" className="max-w-md" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-auto">
          <option value="">All stages</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="select w-auto">
          <option value="">All tiers</option>
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="ml-auto text-xs text-ink-500">
          {filtered.length} of {companies.length}
        </span>
      </Toolbar>

      {loading ? (
        <Loading label="Loading companies" />
      ) : filtered.length ? (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(c => (
            <Card key={c.id} className="flex flex-col p-4 transition-colors duration-base ease-out hover:border-ink-300">
              <div className="flex items-start gap-3">
                <Avatar name={c.name} size={38} rounded="md" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-md font-semibold tracking-snug text-ink-900">{c.name}</h3>
                  <p className="truncate text-xs text-ink-500">{c.industry || 'Industry not set'}</p>
                </div>
                {canWrite ? (
                  <StatusSelect
                    value={c.tier}
                    options={TIERS}
                    onChange={tier => changeTier(c.id, tier)}
                    tone={TIER_TONE[c.tier] || 'neutral'}
                  />
                ) : (
                  <Pill tone={TIER_TONE[c.tier] || 'neutral'}>{c.tier}</Pill>
                )}
              </div>

              {c.description && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-600">{c.description}</p>
              )}

              {!!c.cultureTags?.length && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.cultureTags.slice(0, 4).map(t => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}

              <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-200 pt-3 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-ink-400" />
                  {c.location?.city || c.location?.country || 'Location not set'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users2 className="h-3.5 w-3.5 text-ink-400" />
                  {c.size || '—'}
                </span>
                {c.website && (
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-accent-600 hover:text-accent-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Website
                  </a>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-200 pt-3">
                <StatusSelect
                  value={c.status}
                  options={STATUSES}
                  onChange={status => changeStatus(c.id, status)}
                  disabled={!canWrite}
                />
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-2xs text-ink-400">
                    {c.accountManager
                      ? `AM · ${c.accountManager.firstName} ${c.accountManager.lastName}`
                      : `Added ${new Date(c.createdAt).toLocaleDateString()}`}
                  </span>
                  {canWrite && (
                    <IconBtn
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      label={`Edit ${c.name}`}
                      onClick={() => openEdit(c)}
                    />
                  )}
                  {canDelete && (
                    <IconBtn
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      label={`Delete ${c.name}`}
                      tone="danger"
                      onClick={() => setDeleting(c)}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No companies match these filters"
            hint="Try clearing the tier or stage filter."
            action={
              <Btn
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                  setTierFilter('')
                }}
              >
                Reset filters
              </Btn>
            }
          />
        </Card>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.name}` : 'Add company'}
        description={
          editing
            ? 'Pipeline stage is changed on the card itself, so the move is recorded in the audit trail.'
            : 'Creates the account and starts its pipeline at the selected stage.'
        }
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn form="company-form" type="submit" variant="primary" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create company'}
            </Btn>
          </>
        }
      >
        <form id="company-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Company name">
              <input required className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Industry">
            <input className={inputClass} value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
          </Field>
          <Field label="Size">
            <select className={selectClass} value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Tier">
            <select className={selectClass} value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          {!editing && (
            <Field label="Pipeline stage">
              <select className={selectClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Website">
              <input className={inputClass} placeholder="https://example.com" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Culture tags" hint="Comma separated, e.g. remote-friendly, fast-paced">
              <input className={inputClass} value={form.cultureTags} onChange={e => setForm({ ...form, cultureTags: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea rows={3} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name || 'this company'}?`}
        message="This permanently removes the client account and its pipeline history. Jobs and placements already linked to it are kept. This cannot be undone."
        confirmLabel="Delete company"
        loading={removing}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
