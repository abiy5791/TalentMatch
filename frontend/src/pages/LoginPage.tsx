import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Search } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { PublicFilters } from '../types'
import { homePathFor } from '../components/ProtectedRoute'
import { Alert, Btn, humanize } from '../components/ui'

/** A seeded sign-in, as reported by the API — never a list kept in the client. */
interface DemoAccount {
  email: string
  password: string
  name: string
  role: string
  company?: string | null
  group: string
}

function Mark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-11 w-11 py-2.5 gap-[3px]' : 'h-8 w-8 py-2 gap-[2px]'
  const bar = size === 'lg' ? 'w-1' : 'w-[3px]'
  return (
    <span className={`flex shrink-0 items-end justify-center rounded-md bg-ink-900 ${box}`}>
      <span className={`${bar} h-2 rounded-[1px] bg-accent-300`} />
      <span className={`${bar} h-3.5 rounded-[1px] bg-accent-400`} />
      <span className={`${bar} h-5 rounded-[1px] bg-accent-500`} />
    </span>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demo, setDemo] = useState<DemoAccount[]>([])
  const [board, setBoard] = useState<PublicFilters | null>(null)
  const { login, user } = useAuth()
  const navigate = useNavigate()

  // Both panels below are filled from the database: the sign-ins that actually
  // exist, and what the board currently holds. Either failing just hides it.
  useEffect(() => {
    api.get<DemoAccount[]>('/auth/demo-accounts').then(setDemo).catch(() => undefined)
    api.get<PublicFilters>('/public/jobs/filters').then(setBoard).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (user) navigate(homePathFor(user), { replace: true })
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const signedIn = await login(email, password)
      navigate(homePathFor(signedIn), { replace: true })
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* ---- Brand panel ---- */}
      <div className="relative hidden w-[46%] max-w-[560px] flex-col justify-between bg-ink-900 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Mark size="lg" />
          <span className="text-xl font-semibold tracking-snug text-white">TalentMatch</span>
        </div>

        <div>
          <p className="text-2xs font-semibold uppercase tracking-eyebrow text-accent-400">Recruiter console</p>
          <h2 className="mt-3 max-w-sm text-3xl font-semibold tracking-tight text-white">
            Match verified talent to live roles.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-400">
            Weighted scoring across skills, experience, location, salary and culture — with the full pipeline from
            first screen to signed placement in one place.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-ink-800 pt-8">
          {board
            ? [
                ['Open roles', board.total],
                ['Cities hiring', board.locations.length],
                ['Skills tracked', board.skills.length],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dd className="font-mono text-xl font-medium tnum text-white">{value}</dd>
                  <dt className="mt-1 text-2xs uppercase tracking-eyebrow text-ink-500">{label}</dt>
                </div>
              ))
            : null}
        </dl>
      </div>

      {/* ---- Form ---- */}
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Mark />
            <span className="text-lg font-semibold tracking-snug text-ink-900">TalentMatch</span>
          </div>

          <p className="eyebrow">Sign in</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Staff, employers and applicants all sign in here — you land on the right place automatically.
          </p>

          {error && (
            <div className="mt-5">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="eyebrow mb-1.5 block">Email</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                className="input"
                placeholder="you@talentmatch.io"
              />
            </label>

            <label className="block">
              <span className="eyebrow mb-1.5 block">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 transition-colors
                    duration-base ease-out hover:text-ink-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <Btn
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Btn>
          </form>

          {demo.length > 0 && (
            <div className="mt-7 rounded-md border border-ink-200 bg-white p-3">
              <p className="eyebrow mb-2">Demo accounts — click to fill</p>
              {[...new Set(demo.map(a => a.group))].map(group => (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="px-2 pb-1 text-2xs uppercase tracking-eyebrow text-ink-400">{group}</p>
                  <div className="space-y-0.5">
                    {demo
                      .filter(a => a.group === group)
                      .map(acc => (
                        <button
                          key={acc.email}
                          type="button"
                          onClick={() => {
                            setEmail(acc.email)
                            setPassword(acc.password)
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left
                            transition-colors duration-base ease-out hover:bg-ink-100"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-ink-900">{acc.name}</span>
                            <span className="block truncate font-mono text-2xs text-ink-500">{acc.email}</span>
                          </span>
                          <span className="shrink-0 text-2xs uppercase tracking-eyebrow text-ink-400">
                            {acc.company || humanize(acc.role)}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 text-center text-sm text-ink-500">
            Looking for a job?{' '}
            <Link
              to="/careers"
              className="inline-flex items-center gap-1 font-medium text-accent-600 hover:text-accent-700"
            >
              <Search className="h-3.5 w-3.5" /> Browse open roles
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
