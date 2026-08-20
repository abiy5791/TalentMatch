import { useState } from 'react'
import { Outlet, useLocation, Link, useNavigate, NavLink } from 'react-router-dom'
import { LayoutDashboard, Briefcase, Users, Trophy, LogOut, Menu, X, UsersRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { HeaderActionsProvider, useHeaderActionSlot } from './HeaderActions'
import { Avatar, Pill } from './ui'
import { PERMISSIONS as P, Permission } from '../lib/permissions'

const NAV: { path: string; label: string; icon: typeof Users; end: boolean; permission?: Permission }[] = [
  { path: '/portal', label: 'Overview', icon: LayoutDashboard, end: true },
  { path: '/portal/candidates', label: 'Submitted talent', icon: Users, end: false },
  { path: '/portal/roles', label: 'Our roles', icon: Briefcase, end: false },
  { path: '/portal/placements', label: 'Placements', icon: Trophy, end: false },
  // Account owners only — the visible difference between the two client roles.
  { path: '/portal/team', label: 'Team access', icon: UsersRound, end: false, permission: P.PORTAL_TEAM_READ },
]

const PAGE_META: Record<string, { eyebrow: string; title: string }> = {
  '/portal': { eyebrow: 'Client portal', title: 'Overview' },
  '/portal/candidates': { eyebrow: 'For your review', title: 'Submitted talent' },
  '/portal/roles': { eyebrow: 'Your requisitions', title: 'Our roles' },
  '/portal/placements': { eyebrow: 'Hires made', title: 'Placements' },
  '/portal/team': { eyebrow: 'Account owner', title: 'Team access' },
}

function Mark() {
  return (
    <span className="flex h-[26px] w-[26px] shrink-0 items-end justify-center gap-[2px] rounded-sm bg-ink-900 py-1.5">
      <span className="h-1.5 w-[3px] rounded-[1px] bg-accent-300" />
      <span className="h-2.5 w-[3px] rounded-[1px] bg-accent-400" />
      <span className="h-3.5 w-[3px] rounded-[1px] bg-accent-500" />
    </span>
  )
}

/**
 * The employer-facing shell. Deliberately a different, smaller navigation than
 * the recruiter console — a client only ever has four places to be.
 */
function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, can } = useAuth()
  const actions = useHeaderActionSlot()

  const meta = PAGE_META[location.pathname] || { eyebrow: 'Client portal', title: 'TalentMatch' }
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Account'

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const links = (onNavigate?: () => void) =>
    NAV.filter(item => !item.permission || can(item.permission)).map(item => {
      const Icon = item.icon
      return (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative mb-px flex h-[33px] items-center gap-2.5 rounded-sm px-2 text-sm
             transition-colors duration-base ease-out
             ${isActive ? 'bg-ink-100 font-semibold text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent-500" />}
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {item.label}
            </>
          )}
        </NavLink>
      )
    })

  return (
    <div className="flex h-full bg-ink-50">
      <aside className="hidden w-[216px] shrink-0 flex-col border-r border-ink-200 bg-white px-2.5 pb-2.5 pt-4 lg:flex">
        <Link to="/portal" className="mb-1 flex items-center gap-2.5 px-2">
          <Mark />
          <span className="text-base font-semibold tracking-snug text-ink-900">TalentMatch</span>
        </Link>
        <p className="mb-4 px-2 text-2xs uppercase tracking-eyebrow text-ink-400">Client portal</p>

        <nav className="-mx-1 flex-1 overflow-y-auto px-1">{links()}</nav>

        <div className="mt-2.5 border-t border-ink-200 pt-2.5">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Avatar name={fullName} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{fullName}</p>
              <p className="truncate text-2xs text-ink-500">{user?.company?.name}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-1 flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-sm text-ink-600
              transition-colors duration-base ease-out hover:bg-ink-100 hover:text-ink-900"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} /> Sign out
          </button>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-200 bg-white px-4 py-3 lg:px-6 lg:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMenuOpen(v => !v)} className="lg:hidden" aria-label="Menu">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
            </button>
            <div className="min-w-0">
              <p className="eyebrow truncate">{meta.eyebrow}</p>
              <h1 className="truncate text-xl font-semibold tracking-snug text-ink-900">{meta.title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user?.company?.tier && user.company.tier !== 'STANDARD' && (
              <Pill tone="accent">{user.company.tier}</Pill>
            )}
            <span className="hidden text-sm text-ink-600 sm:inline">{user?.company?.name}</span>
            {actions}
          </div>
        </header>

        {menuOpen && (
          <div className="border-b border-ink-200 bg-white px-3 py-2 lg:hidden">
            {links(() => setMenuOpen(false))}
            <button
              onClick={signOut}
              className="mt-1 flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-sm text-ink-600 hover:bg-ink-100"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} /> Sign out
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 pb-8 pt-4 lg:px-6 lg:pt-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PortalLayout() {
  return (
    <HeaderActionsProvider>
      <Shell />
    </HeaderActionsProvider>
  )
}
