/**
 * Single source of truth for RBAC.
 *
 * Routes declare the permission they need with @RequirePermissions(); the client
 * receives the caller's resolved permission list at login and uses the same
 * strings to decide what to render. Adding a capability means adding it here
 * once, not in two places that can drift apart.
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

  /** Operational metrics: pipeline volumes, gap analysis, time-to-fill. */
  ANALYTICS_READ: 'analytics:read',
  /** Commercial metrics: placement fees and revenue. */
  ANALYTICS_FINANCIALS: 'analytics:financials',

  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',

  /**
   * Client portal. Deliberately a separate namespace: portal routes never accept
   * a console permission and console routes never accept a portal one, so an
   * employer login cannot reach internal data by any route.
   */
  PORTAL_ACCESS: 'portal:access',
  PORTAL_JOBS_READ: 'portal:jobs:read',
  PORTAL_JOBS_REQUEST: 'portal:jobs:request',
  PORTAL_CANDIDATES_READ: 'portal:candidates:read',
  PORTAL_CANDIDATES_RESPOND: 'portal:candidates:respond',
  PORTAL_PLACEMENTS_READ: 'portal:placements:read',
  PORTAL_FEEDBACK_WRITE: 'portal:feedback:write',
  PORTAL_TEAM_READ: 'portal:team:read',
  PORTAL_TEAM_MANAGE: 'portal:team:manage',

  /**
   * Candidate self-service. A third namespace: an applicant sees their own
   * applications and profile and nothing else in the system.
   */
  ME_ACCESS: 'me:access',
  ME_PROFILE_READ: 'me:profile:read',
  ME_PROFILE_WRITE: 'me:profile:write',
  ME_APPLICATIONS_READ: 'me:applications:read',
  ME_APPLICATIONS_APPLY: 'me:applications:apply',
  ME_APPLICATIONS_WITHDRAW: 'me:applications:withdraw',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type Role =
  | 'SUPER_ADMIN' | 'MANAGER' | 'RECRUITER'
  | 'CLIENT_ADMIN' | 'CLIENT_USER'
  | 'CANDIDATE';

const P = PERMISSIONS;

/**
 * Recruiters run day-to-day sourcing: they own candidates, drafts and the
 * pipeline. Commercial decisions — approving a role to go live, client tiers,
 * signing off verification, recording a placement and its fee — sit with
 * managers. Only the super admin creates accounts or deletes client records.
 */
const RECRUITER: Permission[] = [
  P.CANDIDATES_READ,
  P.CANDIDATES_WRITE,
  P.COMPANIES_READ,
  P.JOBS_READ,
  P.JOBS_WRITE,
  P.MATCHING_READ,
  P.MATCHING_CALCULATE,
  P.MATCHING_DISPATCH,
  P.PIPELINE_READ,
  P.PIPELINE_TRANSITION,
  P.PLACEMENTS_READ,
  P.ANALYTICS_READ,
];

const MANAGER: Permission[] = [
  ...RECRUITER,
  P.CANDIDATES_VERIFY,
  P.CANDIDATES_DELETE,
  P.MATCHING_CONFIGURE,
  P.COMPANIES_WRITE,
  P.JOBS_APPROVE,
  P.JOBS_CLOSE,
  P.PLACEMENTS_WRITE,
  P.ANALYTICS_FINANCIALS,
  P.USERS_READ,
];

const SUPER_ADMIN: Permission[] = [
  ...MANAGER,
  P.COMPANIES_DELETE,
  P.PLACEMENTS_DELETE,
  P.USERS_WRITE,
];

/**
 * Client-portal roles. An employer sees only what was formally sent to them for
 * their own roles — never the talent pool, other clients, or any fee figure.
 *
 * CLIENT_USER is a hiring manager: they review the talent put in front of them
 * and say yes or no. Everything that commits the employer — opening a new
 * requisition, signing off a hire, granting a colleague access — belongs to the
 * account owner below.
 */
const CLIENT_USER: Permission[] = [
  P.PORTAL_ACCESS,
  P.PORTAL_JOBS_READ,
  P.PORTAL_CANDIDATES_READ,
  P.PORTAL_CANDIDATES_RESPOND,
  P.PORTAL_PLACEMENTS_READ,
];

/**
 * The employer's account owner. Beyond reviewing talent they run the
 * relationship: they brief new roles, sign off how a hire worked out, and decide
 * which of their own colleagues can get into the portal.
 */
const CLIENT_ADMIN: Permission[] = [
  ...CLIENT_USER,
  P.PORTAL_JOBS_REQUEST,
  P.PORTAL_FEEDBACK_WRITE,
  P.PORTAL_TEAM_READ,
  P.PORTAL_TEAM_MANAGE,
];

/** An applicant tracking their own progress. Sees nothing but their own record. */
const CANDIDATE: Permission[] = [
  P.ME_ACCESS,
  P.ME_PROFILE_READ,
  P.ME_PROFILE_WRITE,
  P.ME_APPLICATIONS_READ,
  P.ME_APPLICATIONS_APPLY,
  P.ME_APPLICATIONS_WITHDRAW,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN,
  MANAGER,
  RECRUITER,
  CLIENT_ADMIN,
  CLIENT_USER,
  CANDIDATE,
};

/** Three surfaces: staff use the console, employers the portal, applicants their own area. */
export const CLIENT_ROLES: Role[] = ['CLIENT_ADMIN', 'CLIENT_USER'];

export function isClientRole(role: string): boolean {
  return CLIENT_ROLES.includes(role as Role);
}

export function isCandidateRole(role: string): boolean {
  return role === 'CANDIDATE';
}

export type Surface = 'console' | 'portal' | 'candidate';

/** Where a successful login should land. */
export function homeFor(role: string): Surface {
  if (isCandidateRole(role)) return 'candidate';
  return isClientRole(role) ? 'portal' : 'console';
}

export function permissionsFor(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

export function hasPermission(role: string, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/** Short label describing what a role is for — surfaced in the UI. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: 'Full access including user management and record deletion',
  MANAGER: 'Approves roles and placements, owns client accounts and revenue reporting',
  RECRUITER: 'Sources and matches talent, runs the pipeline and dispatches candidates',
  CLIENT_ADMIN: 'Employer account owner: briefs roles, rates hires and manages portal access for colleagues',
  CLIENT_USER: 'Employer reviewer: reviews submitted talent and responds on their roles',
  CANDIDATE: 'Applicant: tracks their own applications and keeps their profile current',
};
