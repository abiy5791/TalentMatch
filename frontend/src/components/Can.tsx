import { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Permission } from '../lib/permissions'

interface CanProps {
  /** All listed permissions are required. */
  permission: Permission | Permission[]
  children: ReactNode
  /** Rendered instead when the role lacks the permission (e.g. a read-only badge). */
  fallback?: ReactNode
}

/**
 * Renders children only when the signed-in role holds the permission.
 *
 * This is presentation only — the API enforces the same rule, so hiding a
 * control is about not offering an action that would 403.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useAuth()
  const needed = Array.isArray(permission) ? permission : [permission]
  return <>{can(...needed) ? children : fallback}</>
}
