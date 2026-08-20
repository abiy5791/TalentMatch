import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, Link, useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { HeaderActionsProvider, useHeaderActionSlot } from './HeaderActions'
import { Avatar, Pill, humanize } from './ui'
import { PERMISSIONS as P, Permission } from '../lib/permissions'
import {
  LayoutDashboard, Building2, Users, Briefcase, Zap, GitBranch, BarChart3,
  Trophy, Settings, LogOut, Bell, ChevronRight, Menu, X, Inbox,
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: typeof Users
  /** Hidden unless the signed-in role holds this permission. */
  permission?: Permission
}

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/analytics', label: 'Analytics', icon: BarChart3, permission: P.ANALYTICS_READ },
    ],
  },
  {
    group: 'Demand',
    items: [
      { path: '/companies', label: 'Companies', icon: Building2, permission: P.COMPANIES_READ },
      { path: '/jobs', label: 'Jobs', icon: Briefcase, permission: P.JOBS_READ },
      { path: '/applications', label: 'Applications', icon: Inbox, permission: P.CANDIDATES_READ },
    ],
  },
  {
    group: 'Talent',
    items: [
      { path: '/candidates', label: 'Candidates', icon: Users, permission: P.CANDIDATES_READ },
      { path: '/matching', label: 'Matching', icon: Zap, permission: P.MATCHING_READ },
      { path: '/pipeline', label: 'Pipeline', icon: GitBranch, permission: P.PIPELINE_READ },
      { path: '/placements', label: 'Placements', icon: Trophy, permission: P.PLACEMENTS_READ },
    ],
  },
  {
    group: 'Admin',
    items: [{ path: '/settings', label: 'Settings', icon: Settings }],
  },
]

const PAGE_META: Record<string, { eyebrow: string; title: string }> = {
  '/dashboard': { eyebrow: 'Overview', title: 'Dashboard' },
  '/companies': { eyebrow: 'Client accounts', title: 'Companies' },
  '/candidates': { eyebrow: 'Talent pool', title: 'Candidates' },
  '/jobs': { eyebrow: 'Open requisitions', title: 'Jobs' },
  '/applications': { eyebrow: 'Inbound from the careers site', title: 'Applications' },
  '/matching': { eyebrow: 'Weighted scoring', title: 'Talent matching' },
  '/pipeline': { eyebrow: 'Lifecycle tracker', title: 'Pipeline' },
  '/placements': { eyebrow: 'Closed business', title: 'Placements' },
  '/analytics': { eyebrow: 'Performance', title: 'Analytics' },
  '/settings': { eyebrow: 'Workspace', title: 'Settings' },
}

/** Bottom-tab set for narrow viewports; everything else lives behind “More”. */
const MOBILE_TABS: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/candidates', label: 'Talent', icon: Users, permission: P.CANDIDATES_READ },
  { path: '/matching', label: 'Matching', icon: Zap, permission: P.MATCHING_READ },
  { path: '/pipeline', label: 'Pipeline', icon: GitBranch, permission: P.PIPELINE_READ },
]

const MOBILE_MORE: NavItem[] = [
  { path: '/companies', label: 'Companies', icon: Building2, permission: P.COMPANIES_READ },
  { path: '/jobs', label: 'Jobs', icon: Briefcase, permission: P.JOBS_READ },
  { path: '/applications', label: 'Applications', icon: Inbox, permission: P.CANDIDATES_READ },
  { path: '/placements', label: 'Placements', icon: Trophy, permission: P.PLACEMENTS_READ },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, permission: P.ANALYTICS_READ },
  { path: '/settings', label: 'Settings', icon: Settings },
]

interface NotificationItem {
  id: string
  subject: string
  content: string
  createdAt: string
  readAt: string | null
}

function Logo() {
  return (
    <span className="flex h-[26px] w-[26px] shrink-0 items-end justify-center gap-[2px] rounded-sm bg-ink-900 py-1.5">
      <span className="h-1.5 w-[3px] rounded-[1px] bg-accent-300" />
      <span className="h-2.5 w-[3px] rounded-[1px] bg-accent-400" />
      <span className="h-3.5 w-[3px] rounded-[1px] bg-accent-500" />
    </span>
  )
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
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
}

function Notifications({ userId }: { userId?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userId) return
    api
      .get<NotificationItem[]>(`/notifications/user/${userId}`)
      .then(setItems)
      .catch(() => setItems([]))
  }, [userId, location.pathname])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const unread = items.filter(n => !n.readAt).length

  const markRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`)
      setItems(prev => prev.map(n => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)))
    } catch {
      /* non-critical */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
        className="relative flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-ink-300
          bg-white text-ink-500 transition-colors duration-base ease-out hover:bg-ink-100 hover:text-ink-700"
      >
        <Bell className="h-4 w-4" strokeWidth={1.9} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-500" />}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 animate-slide-up overflow-hidden rounded-md border border-ink-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-200 bg-ink-50 px-3.5 py-2.5">
            <span className="eyebrow">Notifications</span>
            {unread > 0 && <span className="font-mono text-2xs tnum text-ink-500">{unread} unread</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length ? (
              items.slice(0, 8).map(n => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`block w-full border-b border-ink-200 px-3.5 py-2.5 text-left transition-colors
                    duration-base ease-out last:border-0 hover:bg-ink-50 ${n.readAt ? 'opacity-55' : ''}`}
                >
                  <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                    {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />}
                    {n.subject}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.content}</p>
                  <p className="mt-1 font-mono text-2xs text-ink-400">{new Date(n.createdAt).toLocaleString()}</p>
                </button>
              ))
            ) : (
              <p className="px-3.5 py-8 text-center text-sm text-ink-400">Nothing new.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Shell() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, can } = useAuth()
  const actions = useHeaderActionSlot()

  // Navigation reflects the signed-in role: sections this account cannot open
  // are not shown at all, and a group with nothing left in it disappears.
  const allowed = (items: NavItem[]) => items.filter(i => !i.permission || can(i.permission))
  const navGroups = NAV_GROUPS.map(g => ({ ...g, items: allowed(g.items) })).filter(g => g.items.length)
  const mobileTabs = allowed(MOBILE_TABS)
  const mobileMore = allowed(MOBILE_MORE)

  const meta = PAGE_META[location.pathname] || { eyebrow: 'Workspace', title: 'TalentMatch' }
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Account'

  useEffect(() => setMoreOpen(false), [location.pathname])

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full bg-ink-50">
      {/* ---- Sidebar (desktop) ---- */}
      <aside className="hidden w-[216px] shrink-0 flex-col border-r border-ink-200 bg-white px-2.5 pb-2.5 pt-4 lg:flex">
        <Link to="/dashboard" className="mb-4 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="text-base font-semibold tracking-snug text-ink-900">TalentMatch</span>
        </Link>

        <nav className="-mx-1 flex-1 overflow-y-auto px-1">
          {navGroups.map(({ group, items }) => (
            <div key={group}>
              <p className="eyebrow px-2 pb-1.5 pt-4 first:pt-0">{group}</p>
              {items.map(item => (
                <SidebarLink key={item.path} item={item} />
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-2.5 border-t border-ink-200 pt-2.5">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Avatar name={fullName} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{fullName}</p>
              <p className="truncate text-2xs capitalize text-ink-500">
                {humanize(user?.role).toLowerCase()}
              </p>
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

      {/* ---- Main column ---- */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-200 bg-white px-4 py-3 lg:px-6 lg:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/dashboard" className="lg:hidden">
              <Logo />
            </Link>
            <div className="min-w-0">
              <p className="eyebrow truncate">{meta.eyebrow}</p>
              <h1 className="truncate text-xl font-semibold tracking-snug text-ink-900">{meta.title}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Notifications userId={user?.id} />
            {actions}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-5">
          <Outlet />
        </main>

        {/* ---- Bottom nav (mobile) ---- */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-200 bg-white lg:hidden">
          {mobileTabs.map(item => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 text-[10px]
                  font-medium ${active ? 'text-accent-600' : 'text-ink-500'}`}
              >
                <Icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
                {item.label}
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={`flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium
              ${moreOpen || mobileMore.some(m => m.path === location.pathname) ? 'text-accent-600' : 'text-ink-500'}`}
          >
            {moreOpen ? <X className="h-[19px] w-[19px]" /> : <Menu className="h-[19px] w-[19px]" strokeWidth={1.75} />}
            More
          </button>
        </nav>

        {/* ---- “More” sheet (mobile) ---- */}
        {moreOpen && (
          <>
            <div
              className="fixed inset-0 z-30 animate-fade-in bg-ink-900/40 backdrop-blur-[2px] lg:hidden"
              onClick={() => setMoreOpen(false)}
            />
            <div className="fixed inset-x-0 bottom-[54px] z-40 animate-slide-up rounded-t-lg border-t border-ink-200 bg-white px-4 pb-4 pt-2.5 shadow-xl lg:hidden">
              <span className="mx-auto mb-3 block h-1 w-9 rounded-full bg-ink-300" />
              {mobileMore.map(item => {
                const Icon = item.icon
                const active = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex min-h-[46px] items-center gap-3 border-b border-ink-200 text-base
                      last:border-0 ${active ? 'text-accent-600' : 'text-ink-900'}`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-ink-400" />
                  </Link>
                )
              })}
              <div className="mt-3 flex items-center gap-2.5 border-t border-ink-200 pt-3">
                <Avatar name={fullName} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{fullName}</p>
                  <p className="truncate text-2xs text-ink-500">{user?.email}</p>
                </div>
                <Pill tone="neutral">{humanize(user?.role)}</Pill>
              </div>
              <button
                onClick={signOut}
                className="btn btn-md btn-secondary mt-3 w-full"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Layout() {
  return (
    <HeaderActionsProvider>
      <Shell />
    </HeaderActionsProvider>
  )
}
