import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

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
 * Chrome for the pages a logged-out visitor can reach. Deliberately plain — no
 * sidebar, no app furniture, just the board and a way in.
 *
 * Pages that need a richer masthead than eyebrow/title/subtitle pass `header`
 * and own that block themselves; everything else gets the default heading.
 */
export function PublicShell({
  eyebrow,
  title,
  subtitle,
  header,
  children,
}: {
  eyebrow?: string
  title?: ReactNode
  subtitle?: ReactNode
  header?: ReactNode
  children: ReactNode
}) {
  const { user } = useAuth()
  const home = user?.home === 'candidate' ? '/me' : user?.home === 'portal' ? '/portal' : '/dashboard'

  return (
    // Column layout with a growing main: on a short page the footer sits on the
    // bottom edge of the viewport instead of floating in the middle of it.
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-3 px-5 py-3.5">
          <Link to="/careers" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-base font-semibold tracking-snug text-ink-900">TalentMatch</span>
            <span className="hidden text-2xs uppercase tracking-eyebrow text-ink-400 sm:inline">Careers</span>
          </Link>
          {user ? (
            <Link to={home} className="btn btn-sm btn-secondary">
              {user.home === 'candidate' ? 'My applications' : 'Open app'}
            </Link>
          ) : (
            <Link to="/login" className="btn btn-sm btn-secondary">Sign in</Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1040px] flex-1 px-5 py-8">
        {header ?? (
          <>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-ink-900">{title}</h1>}
            {subtitle && <p className="mt-2 max-w-2xl text-base text-ink-600">{subtitle}</p>}
          </>
        )}
        <div className="mt-6 space-y-3.5">{children}</div>
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-ink-500">
          <p>
            Applied already?{' '}
            <Link to="/login" className="font-medium text-accent-600 hover:text-accent-700">
              Sign in to track your application
            </Link>
            .
          </p>
          <p className="text-ink-400">© {new Date().getFullYear()} TalentMatch</p>
        </div>
      </footer>
    </div>
  )
}
