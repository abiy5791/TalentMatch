import { Outlet, useLocation, Link, useNavigate, NavLink } from 'react-router-dom'
import { ClipboardList, UserRound, Search, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './ui'

const NAV = [
  { path: '/me', label: 'My applications', icon: ClipboardList, end: true },
  { path: '/me/profile', label: 'My profile', icon: UserRound, end: false },
]

const PAGE_META: Record<string, { eyebrow: string; title: string }> = {
  '/me': { eyebrow: 'Your progress', title: 'My applications' },
  '/me/profile': { eyebrow: 'Your details', title: 'My profile' },
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
 * The applicant's own area. Two screens and a way back to the board — an
 * applicant has no reason for app furniture beyond that.
 */
export function CandidateLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const meta = PAGE_META[location.pathname] || { eyebrow: 'Your account', title: 'TalentMatch' }
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Account'

  const signOut = () => {
    logout()
    navigate('/careers', { replace: true })
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[980px] items-center justify-between gap-3 px-5 py-3">
          <Link to="/me" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-base font-semibold tracking-snug text-ink-900">TalentMatch</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/careers" className="btn btn-sm btn-secondary">
              <Search className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Browse roles</span>
            </Link>
            <Avatar name={fullName} size={30} />
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-ink-300
                text-ink-500 transition-colors duration-base ease-out hover:bg-ink-100 hover:text-ink-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[980px] gap-1 px-4">
          {NAV.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors duration-base ease-out
                   ${isActive
                     ? 'border-b-accent-500 font-semibold text-ink-900'
                     : 'border-b-transparent text-ink-500 hover:text-ink-900'}`
                }
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[980px] px-5 py-6">
        <p className="eyebrow">{meta.eyebrow}</p>
        <h1 className="mb-5 mt-1 text-2xl font-semibold tracking-snug text-ink-900">{meta.title}</h1>
        <Outlet />
      </main>
    </div>
  )
}
