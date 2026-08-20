import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Plus, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { PERMISSIONS as P, ROLE_LABELS } from '../../lib/permissions'
import { TeamMember } from '../../types'
import { Modal, Field, inputClass, selectClass } from '../../components/Modal'
import { useHeaderActions } from '../../components/HeaderActions'
import {
  Alert, Avatar, Btn, Card, CardHead, EmptyState, Loading, Pill, StatusSelect, Tone, humanize,
} from '../../components/ui'

const roleTone: Record<string, Tone> = { CLIENT_ADMIN: 'warning', CLIENT_USER: 'neutral' }

/** What each portal role can do, in the employer's own language. */
const ROLE_SUMMARY: Record<string, string> = {
  CLIENT_ADMIN: 'Reviews talent, opens new roles, rates hires and manages this team',
  CLIENT_USER: 'Reviews talent and responds — cannot open roles or change access',
}

const emptyForm = { email: '', password: '', firstName: '', lastName: '', role: 'CLIENT_USER' }

export function PortalTeamPage() {
  const { user, can } = useAuth()
  const canManage = can(P.PORTAL_TEAM_MANAGE)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTeam(await api.get<TeamMember[]>('/portal/team'))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load your team')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useHeaderActions(
    canManage ? (
      <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
        <span className="hidden sm:inline">Invite colleague</span>
        <span className="sm:hidden">Invite</span>
      </Btn>
    ) : null,
    [canManage],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/portal/team', form)
      setNotice(`${form.email} can now sign in to your portal.`)
      setModalOpen(false)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not invite your colleague')
    }
    setSaving(false)
  }

  const change = async (id: string, patch: { status?: string; role?: string }) => {
    setError('')
    try {
      const path = patch.status ? 'status' : 'role'
      const updated = await api.patch<TeamMember>(`/portal/team/${id}/${path}`, patch)
      setTeam(prev => prev.map(m => (m.id === id ? updated : m)))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update your colleague')
      await load()
    }
  }

  if (loading) return <Loading label="Loading your team" />

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card className="overflow-hidden">
        <CardHead
          title="Portal access"
          subtitle={`Who at ${user?.company?.name} can sign in`}
        />
        {team.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="border-b border-ink-200 bg-white">
                <tr>
                  <th className="th">Person</th>
                  <th className="th">Access level</th>
                  <th className="th">Status</th>
                  <th className="th">Last sign-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {team.map(m => {
                  const isSelf = m.id === user?.id
                  return (
                    <tr key={m.id} className="transition-colors duration-base ease-out hover:bg-ink-50">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${m.firstName} ${m.lastName}`} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">
                              {m.firstName} {m.lastName}
                              {isSelf && <span className="ml-1.5 text-2xs text-ink-400">(you)</span>}
                            </p>
                            <p className="truncate font-mono text-2xs text-ink-500">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        {canManage && !isSelf ? (
                          <select
                            value={m.role}
                            onChange={e => change(m.id, { role: e.target.value })}
                            className="select h-8 py-0 text-xs"
                          >
                            <option value="CLIENT_USER">{ROLE_LABELS.CLIENT_USER}</option>
                            <option value="CLIENT_ADMIN">{ROLE_LABELS.CLIENT_ADMIN}</option>
                          </select>
                        ) : (
                          <Pill tone={roleTone[m.role] || 'neutral'}>{ROLE_LABELS[m.role]}</Pill>
                        )}
                        <p className="mt-1 max-w-[280px] text-2xs text-ink-500">{ROLE_SUMMARY[m.role]}</p>
                      </td>
                      <td className="td">
                        <StatusSelect
                          value={m.status}
                          options={['ACTIVE', 'SUSPENDED']}
                          disabled={!canManage || isSelf}
                          onChange={status => change(m.id, { status })}
                        />
                      </td>
                      <td className="td whitespace-nowrap font-mono text-xs tnum text-ink-500">
                        {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nobody else yet" hint="Invite a colleague to share the review workload." />
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHead title="Access levels" subtitle="What each level can do in this portal" />
        <div className="divide-y divide-ink-200">
          {(['CLIENT_ADMIN', 'CLIENT_USER'] as const).map(role => (
            <div key={role} className="flex items-start gap-3 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <div className="min-w-0 flex-1">
                <Pill tone={roleTone[role]}>{ROLE_LABELS[role]}</Pill>
                <p className="mt-1.5 text-sm text-ink-700">{ROLE_SUMMARY[role]}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={modalOpen}
        title="Invite a colleague"
        description={`They will be able to sign in to ${user?.company?.name}'s portal.`}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn form="invite-form" type="submit" variant="primary" loading={saving}>
              {saving ? 'Inviting…' : 'Send invite'}
            </Btn>
          </>
        }
      >
        <form id="invite-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <input required className={inputClass} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input required className={inputClass} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Work email">
              <input required type="email" className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Temporary password" hint="Minimum 6 characters">
            <input required type="password" minLength={6} className={inputClass} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Access level" hint={ROLE_SUMMARY[form.role]}>
            <select className={selectClass} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="CLIENT_USER">{ROLE_LABELS.CLIENT_USER}</option>
              <option value="CLIENT_ADMIN">{ROLE_LABELS.CLIENT_ADMIN}</option>
            </select>
          </Field>
        </form>
      </Modal>
    </div>
  )
}
