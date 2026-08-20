import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Search, ArrowRight } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { PublicJob, PublicFilters } from '../../types'
import { Alert, Card, EmptyState, Loading, Tag, humanize, moneyK } from '../../components/ui'
import { PublicShell } from './PublicShell'

export function CareersPage() {
  const [jobs, setJobs] = useState<PublicJob[]>([])
  const [filters, setFilters] = useState<PublicFilters | null>(null)
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [skill, setSkill] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, f] = await Promise.all([
        api.get<PublicJob[]>('/public/jobs', { search, location, skill }),
        api.get<PublicFilters>('/public/jobs/filters'),
      ])
      setJobs(list)
      setFilters(f)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load open roles')
    }
    setLoading(false)
  }, [search, location, skill])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  return (
    <PublicShell
      eyebrow="Open roles"
      title="Find your next role"
      subtitle="Every role here is live and briefed directly by the hiring team."
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or company"
            className="input pl-9"
          />
        </div>
        <select className="select w-auto" value={location} onChange={e => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {filters?.locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="select w-auto" value={skill} onChange={e => setSkill(e.target.value)}>
          <option value="">All skills</option>
          {filters?.skills.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <Loading label="Loading open roles" />
      ) : jobs.length ? (
        <>
          <p className="text-xs text-ink-500">
            {jobs.length} open {jobs.length === 1 ? 'role' : 'roles'}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {jobs.map(job => (
              <Link key={job.id} to={`/careers/${job.slug || job.id}`} className="block">
                <Card className="h-full overflow-hidden transition-shadow duration-base ease-out hover:shadow-md">
                  <div className="border-b border-ink-200 px-4 py-3.5">
                    <h2 className="text-md font-semibold tracking-snug text-ink-900">{job.title}</h2>
                    <p className="mt-0.5 text-sm text-ink-500">{job.company?.name}</p>
                  </div>
                  <div className="space-y-3 px-4 py-3.5">
                    <p className="line-clamp-2 text-sm text-ink-600">{job.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.requiredSkills?.slice(0, 5).map((s, i) => <Tag key={i}>{s.name}</Tag>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location?.city || 'Remote'}
                        {job.location?.remote ? ' · remote friendly' : ''}
                      </span>
                      <span className="font-mono tnum">{moneyK(job.salaryMin, job.currency)} – {moneyK(job.salaryMax, job.currency)}</span>
                      <span>{humanize(job.employmentType)}</span>
                      <span className="ml-auto flex items-center gap-1 font-medium text-accent-600">
                        View role <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="No roles match that search"
          hint="Try clearing the filters — new roles are posted regularly."
        />
      )}
    </PublicShell>
  )
}
