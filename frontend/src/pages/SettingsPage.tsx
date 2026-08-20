import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Company, User } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P, ROLE_LABELS, isClientRole } from '../lib/permissions'
import { Modal, Field, inputClass, selectClass } from '../components/Modal'
import { useHeaderActions } from '../components/HeaderActions'
import { MatchWeightsCard } from '../components/MatchWeightsCard'
import {
  Alert, Avatar, Btn, Card, CardHead, EmptyState, Loading, Pill, Tone, humanize,
} from '../components/ui'

const ASSIGNABLE_ROLES: User['role'][] = [
  'SUPER_ADMIN', 'MANAGER', 'RECRUITER', 'CLIENT_ADMIN', 'CLIENT_USER',
]

const roleTone: Record<string, Tone> = {
  SUPER_ADMIN: 'accent',
  MANAGER: 'info',
  RECRUITER: 'success',
  CLIENT_ADMIN: 'warning',
  CLIENT_USER: 'neutral',
}

/** The capabilities worth showing a human, in the order they matter operationally. */
const CAPABILITIES: { label: string; permission: string }[] = [
  { label: 'Browse candidates and clients', permission: P.CANDIDATES_READ },
  { label: 'Add and edit candidates', permission: P.CANDIDATES_WRITE },
  { label: 'Draft job postings', permission: P.JOBS_WRITE },
  { label: 'Score matches and dispatch talent', permission: P.MATCHING_DISPATCH },
  { label: 'Move candidates through the pipeline', permission: P.PIPELINE_TRANSITION },
  { label: 'Sign off candidate verification', permission: P.CANDIDATES_VERIFY },
  { label: 'Approve and publish roles', permission: P.JOBS_APPROVE },
  { label: 'Manage client accounts and tiers', permission: P.COMPANIES_WRITE },
  { label: 'Record placements and fees', permission: P.PLACEMENTS_WRITE },
  { label: 'See revenue and fee reporting', permission: P.ANALYTICS_FINANCIALS },
  { label: 'View the team roster', permission: P.USERS_READ },
  { label: 'Create user accounts', permission: P.USERS_WRITE },
  { label: 'Delete client records', permission: P.COMPANIES_DELETE },
]

/** Shown instead of the console list when a client-portal account signs in. */
const PORTAL_CAPABILITIES: { label: string; permission: string }[] = [
  { label: 'View your open roles', permission: P.PORTAL_JOBS_READ },
  { label: 'Review submitted talent', permission: P.PORTAL_CANDIDATES_READ },
  { label: 'Shortlist, request interviews, decline', permission: P.PORTAL_CANDIDATES_RESPOND },
  { label: 'See your placements', permission: P.PORTAL_PLACEMENTS_READ },
  { label: 'Request a new role', permission: P.PORTAL_JOBS_REQUEST },
  { label: 'Rate a placement', permission: P.PORTAL_FEEDBACK_WRITE },
  { label: 'Manage portal access for colleagues', permission: P.PORTAL_TEAM_MANAGE },
]

/** One line on what each role is for, shown next to it in the roster. */
const ROLE_SUMMARY: Record<string, string> = {
  SUPER_ADMIN: 'Everything, plus user accounts and deletions',
  MANAGER: 'Approves roles and placements, owns clients and revenue',
  RECRUITER: 'Sources, matches and dispatches talent',
  CLIENT_ADMIN: 'Portal account owner — briefs roles, rates hires, manages their own team',
  CLIENT_USER: 'Portal reviewer — reviews and responds to submitted talent only',
}

interface RoleDefinition {
  role: string
  description: string
  permissions: string[]
}

const emptyForm = {
  email: '', password: '', firstName: '', lastName: '', role: 'RECRUITER', companyId: '',
}

export function SettingsPage() {
  const { user, can } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const canReadUsers = can(P.USERS_READ)
  const canWriteUsers = can(P.USERS_WRITE)
  const granted = new Set(user?.permissions || [])
  const capabilities = isClientRole(user?.role) ? PORTAL_CAPABILITIES : CAPABILITIES

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roleData, userData, companyData] = await Promise.all([
        api.get<RoleDefinition[]>('/auth/roles'),
        canReadUsers ? api.get<User[]>('/auth/users') : Promise.resolve([]),
        // Client accounts must be attached to an employer.
        canWriteUsers ? api.get<Company[]>('/companies', { limit: 200 }) : Promise.resolve([]),
      ])
      setRoles(roleData)
      setUsers(userData)
      setCompanies(companyData)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load settings')
    }
    setLoading(false)
  }, [canReadUsers, canWriteUsers])

  useEffect(() => { load() }, [load])

  useHeaderActions(
    canWriteUsers ? (
      <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
        <span className="hidden sm:inline">Invite user</span>
        <span className="sm:hidden">Invite</span>
      </Btn>
    ) : null,
    [canWriteUsers],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/auth/register', {
        ...form,
        // Only client accounts carry a company; sending it for staff is rejected.
        companyId: isClientRole(form.role) ? form.companyId : undefined,
      })
      setNotice(`${form.email} created as ${humanize(form.role).toLowerCase()}.`)
      setModalOpen(false)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create user')
    }
    setSaving(false)
  }

  if (loading) return <Loading label="Loading settings" />

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {/* ---- Account + what this role can do ---- */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHead title="Your account" subtitle={user?.roleDescription} />
          <div className="flex items-center gap-3 border-b border-ink-200 px-4 py-4">
            <Avatar name={`${user?.firstName || ''} ${user?.lastName || ''}`} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate font-mono text-xs text-ink-500">{user?.email}</p>
            </div>
            <Pill tone={roleTone[user?.role || ''] || 'neutral'}>
              {ROLE_LABELS[user?.role || ''] || humanize(user?.role)}
            </Pill>
          </div>
          <dl className="divide-y divide-ink-200">
            {[
              ['Status', humanize(user?.status)],
              ['Permissions granted', `${user?.permissions?.length ?? 0} of ${capabilities.length} shown below`],
              ['Last sign-in', user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'This session'],
              ['Member since', user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-sm text-ink-500">{label}</dt>
                <dd className="truncate text-sm text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="overflow-hidden">
          <CardHead
            title="Your access"
            subtitle="Granted by your role — the API enforces the same list"
          />
          <div className="max-h-[280px] divide-y divide-ink-200 overflow-y-auto">
            {capabilities.map(c => {
              const allowed = granted.has(c.permission)
              return (
                <div key={c.permission} className="flex items-center gap-2.5 px-4 py-2">
                  {allowed ? (
                    <Check className="h-4 w-4 shrink-0 text-success-500" strokeWidth={2.2} />
                  ) : (
                    <Minus className="h-4 w-4 shrink-0 text-ink-300" strokeWidth={2.2} />
                  )}
                  <span className={`flex-1 text-sm ${allowed ? 'text-ink-900' : 'text-ink-400'}`}>
                    {c.label}
                  </span>
                  <span className="font-mono text-2xs text-ink-400">{c.permission}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ---- Team roster ---- */}
      <Card className="overflow-hidden">
        <CardHead
          title="Team & access"
          subtitle={canReadUsers ? `${users.length} accounts` : 'Restricted'}
        />
        {!canReadUsers ? (
          <EmptyState
            title="Roster not available for your role"
            hint="Viewing team members requires users:read, granted to managers and administrators."
          />
        ) : (
          <>
            {/* The role summary column alone needs ~300px. Rather than push the
                whole roster behind a horizontal scroll, narrow viewports get the
                same rows stacked as cards. */}
            <div className="divide-y divide-ink-200 lg:hidden">
              {users.map(u => (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={`${u.firstName} ${u.lastName}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{u.firstName} {u.lastName}</p>
                      <p className="truncate font-mono text-2xs text-ink-500">{u.email}</p>
                    </div>
                    <Pill tone={roleTone[u.role] || 'neutral'}>{ROLE_LABELS[u.role] || humanize(u.role)}</Pill>
                  </div>
                  <p className="mt-2 text-xs leading-snug text-ink-500">{ROLE_SUMMARY[u.role]}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-500">
                    {(u as any).companyName && <span>{(u as any).companyName}</span>}
                    <span>{humanize(u.status)}</span>
                    <span className="font-mono tnum">
                      {u.lastLoginAt ? `Last login ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'Never signed in'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead className="border-b border-ink-200 bg-white">
                <tr>
                  <th className="th">User</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200">
                {users.map(u => (
                  <tr key={u.id} className="transition-colors duration-base ease-out hover:bg-ink-50">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${u.firstName} ${u.lastName}`} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{u.firstName} {u.lastName}</p>
                          <p className="truncate font-mono text-2xs text-ink-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex flex-col items-start gap-1">
                        <Pill tone={roleTone[u.role] || 'neutral'}>{ROLE_LABELS[u.role] || humanize(u.role)}</Pill>
                        {(u as any).companyName && (
                          <span className="text-2xs text-ink-500">{(u as any).companyName}</span>
                        )}
                        <span className="max-w-[300px] text-2xs leading-snug text-ink-400">
                          {ROLE_SUMMARY[u.role]}
                        </span>
                      </div>
                    </td>
                    <td className="td text-ink-600">{humanize(u.status)}</td>
                    <td className="td whitespace-nowrap font-mono text-xs tnum text-ink-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </Card>

      {/* ---- Role reference ---- */}
      <Card className="overflow-hidden">
        <CardHead title="Roles" subtitle="What each role is responsible for" />
        <div className="divide-y divide-ink-200">
          {roles.map(r => (
            <div key={r.role} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <Pill tone={roleTone[r.role] || 'neutral'}>{ROLE_LABELS[r.role] || humanize(r.role)}</Pill>
              <div className="min-w-[220px] flex-1">
                <p className="text-sm text-ink-700">{r.description}</p>
                <p className="mt-1 font-mono text-2xs text-ink-400">
                  {r.permissions.length ? `${r.permissions.length} permissions` : 'No console access'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ---- Matching weights ---- */}
      <MatchWeightsCard />

      <Modal
        open={modalOpen}
        title="Invite user"
        description="Creates an active account with the selected role."
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn form="user-form" type="submit" variant="primary" loading={saving}>
              {saving ? 'Saving…' : 'Create user'}
            </Btn>
          </>
        }
      >
        <form id="user-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <input required className={inputClass} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input required className={inputClass} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email">
              <input required type="email" className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Password" hint="Minimum 6 characters">
            <input required type="password" minLength={6} className={inputClass} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role" hint="Determines which surface the account signs in to">
            <select
              className={selectClass}
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value, companyId: '' })}
            >
              <optgroup label="Recruiter console">
                {ASSIGNABLE_ROLES.filter(r => !isClientRole(r)).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </optgroup>
              <optgroup label="Client portal">
                {ASSIGNABLE_ROLES.filter(isClientRole).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </optgroup>
            </select>
          </Field>
          {isClientRole(form.role) && (
            <div className="sm:col-span-2">
              <Field
                label="Employer"
                hint="This account will only ever see this company's roles and the candidates submitted to it."
              >
                <select
                  required
                  className={selectClass}
                  value={form.companyId}
                  onChange={e => setForm({ ...form, companyId: e.target.value })}
                >
                  <option value="">Select a company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
