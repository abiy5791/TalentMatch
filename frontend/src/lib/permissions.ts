/**
 * Mirrors backend/src/modules/auth/permissions.ts.
 *
 * The client never decides what a role may do — the API sends the caller's
 * resolved permission list at login and these constants are just the keys used
 * to read it. Hiding a control here is a UX affordance; the API enforces it.
 */
export const PERMISSIONS = {
  CANDIDATES_READ: 'candidates:read',
  CANDIDATES_WRITE: 'candidates:write',
  CANDIDATES_VERIFY: 'candidates:verify',
  CANDIDATES_DELETE: 'candidates:delete',

  COMPANIES_READ: 'companies:read',
  COMPANIES_WRITE: 'companies:write',
  COMPANIES_DELETE: 'companies:delete',

  JOBS_READ: 'jobs:read',
  JOBS_WRITE: 'jobs:write',
  JOBS_APPROVE: 'jobs:approve',
  JOBS_CLOSE: 'jobs:close',

  MATCHING_READ: 'matching:read',
  MATCHING_CALCULATE: 'matching:calculate',
  MATCHING_DISPATCH: 'matching:dispatch',
  MATCHING_CONFIGURE: 'matching:configure',

  PIPELINE_READ: 'pipeline:read',
  PIPELINE_TRANSITION: 'pipeline:transition',

  PLACEMENTS_READ: 'placements:read',
  PLACEMENTS_WRITE: 'placements:write',
  PLACEMENTS_DELETE: 'placements:delete',

  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_FINANCIALS: 'analytics:financials',

  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',

  // Client portal — a separate namespace from the console permissions above.
  PORTAL_ACCESS: 'portal:access',
  PORTAL_JOBS_READ: 'portal:jobs:read',
  PORTAL_JOBS_REQUEST: 'portal:jobs:request',
  PORTAL_CANDIDATES_READ: 'portal:candidates:read',
  PORTAL_CANDIDATES_RESPOND: 'portal:candidates:respond',
  PORTAL_PLACEMENTS_READ: 'portal:placements:read',
  PORTAL_FEEDBACK_WRITE: 'portal:feedback:write',
  PORTAL_TEAM_READ: 'portal:team:read',
  PORTAL_TEAM_MANAGE: 'portal:team:manage',

  // Candidate self-service — a third namespace.
  ME_ACCESS: 'me:access',
  ME_PROFILE_READ: 'me:profile:read',
  ME_PROFILE_WRITE: 'me:profile:write',
  ME_APPLICATIONS_READ: 'me:applications:read',
  ME_APPLICATIONS_WITHDRAW: 'me:applications:withdraw',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** Client accounts live in the portal; everyone else in the console. */
export const isClientRole = (role?: string) =>
  role === 'CLIENT_ADMIN' || role === 'CLIENT_USER'

export const isCandidateRole = (role?: string) => role === 'CANDIDATE'

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  RECRUITER: 'Recruiter',
  CLIENT_ADMIN: 'Client Admin',
  CLIENT_USER: 'Client User',
  CANDIDATE: 'Candidate',
}
