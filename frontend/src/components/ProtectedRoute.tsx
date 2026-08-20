import { Navigate, Outlet } from 'react-router-dom'
import { Loader2, ShieldOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Permission, isCandidateRole, isClientRole } from '../lib/permissions'
import { User } from '../types'
import { humanize } from './ui'

export type Surface = 'console' | 'portal' | 'candidate'

/**
 * The surface an account belongs to. The API sends it as `home`; the role is
 * only a fallback for a session stored before that field existed.
 */
export function surfaceOf(user?: User | null): Surface {
  if (user?.home) return user.home
  if (isCandidateRole(user?.role)) return 'candidate'
  return isClientRole(user?.role) ? 'portal' : 'console'
}

const SURFACE_HOME: Record<Surface, string> = {
  console: '/dashboard',
  portal: '/portal',
  candidate: '/me',
}

/** Where a signed-in account should land. */
export const homePathFor = (user?: User | null) => SURFACE_HOME[surfaceOf(user)]

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-ink-50 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Restoring your session…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * Keeps the three surfaces apart. An employer who lands on a console URL is sent
 * to their portal rather than shown a permission error, an applicant to their
 * own area — being on the wrong surface is a wrong turn, not a denial.
 */
export function RequireSurface({ surface }: { surface: Surface }) {
  const { user } = useAuth()
  const home = surfaceOf(user)
  if (home !== surface) return <Navigate to={SURFACE_HOME[home]} replace />
  return <Outlet />
}

/**
 * Route-level permission gate. The API rejects these calls anyway; this turns a
 * would-be wall of 403s into one clear explanation.
 */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can, user } = useAuth()
  if (can(permission)) return <Outlet />

  return (
    <div className="flex h-full items-start justify-center pt-10">
      <div className="card max-w-md px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-ink-100">
          <ShieldOff className="h-5 w-5 text-ink-400" />
        </div>
        <h2 className="text-lg font-semibold tracking-snug text-ink-900">Not available for your role</h2>
        <p className="mt-2 text-sm text-ink-600">
          This section requires{' '}
          <code className="rounded-xs bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-700">{permission}</code>,
          which is not granted to {humanize(user?.role).toLowerCase()} accounts.
        </p>
        <p className="mt-3 text-xs text-ink-400">Ask an administrator if you need access.</p>
      </div>
    </div>
  )
}
