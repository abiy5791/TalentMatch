import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { PortalOverview, Submission } from '../../types'
import { Alert, Avatar, Card, CardHead, EmptyState, Loading, Pill, StatCard, humanize } from '../../components/ui'

const statusTone: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'> = {
  SENT: 'warning',
  VIEWED: 'info',
  SHORTLISTED: 'success',
  INTERVIEW_REQUESTED: 'accent',
  DECLINED: 'danger',
}

export function PortalOverviewPage() {
  const { user } = useAuth()
  const [overview, setOverview] = useState<PortalOverview | null>(null)
  const [pending, setPending] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [o, subs] = await Promise.all([
          api.get<PortalOverview>('/portal/overview'),
          api.get<Submission[]>('/portal/candidates'),
        ])
        setOverview(o)
        setPending(subs.filter(s => ['SENT', 'VIEWED'].includes(s.status)).slice(0, 5))
        setError('')
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load your portal')
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Loading label="Loading your portal" />

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}

      <p className="text-sm text-ink-600">
        Welcome back, {user?.firstName}. Here is where {user?.company?.name} stands with your recruiting team.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Awaiting your review"
          value={overview?.awaitingReview ?? 0}
          note="Candidates submitted to you"
          to="/portal/candidates"
        />
        <StatCard label="Open roles" value={overview?.openRoles ?? 0} note={`${overview?.totalRoles ?? 0} total`} to="/portal/roles" />
        <StatCard label="Interviews requested" value={overview?.interviewsRequested ?? 0} note="Your team asked to meet" />
        <StatCard label="Hires" value={overview?.placements ?? 0} note={`${overview?.activePlacements ?? 0} currently active`} to="/portal/placements" />
      </div>

      <Card className="overflow-hidden">
        <CardHead
          title="Waiting on you"
          subtitle="Candidates your recruiter has put forward"
          action={
            <Link to="/portal/candidates" className="text-xs font-medium text-accent-600 hover:text-accent-700">
              Review all
            </Link>
          }
        />
        {pending.length ? (
          <div className="divide-y divide-ink-200">
            {pending.map(s => {
              const name = `${s.candidate?.firstName || ''} ${s.candidate?.lastName || ''}`.trim()
              return (
                <Link
                  key={s.id}
                  to="/portal/candidates"
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-base ease-out hover:bg-ink-50"
                >
                  <Avatar name={name || '—'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {s.candidate?.currentTitle} · for {s.job?.title}
                    </p>
                  </div>
                  <Pill tone={statusTone[s.status] || 'neutral'}>{humanize(s.status)}</Pill>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                </Link>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="Nothing waiting on you"
            hint="Your recruiter will submit candidates here as they are matched to your roles."
          />
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Shortlisted" value={overview?.shortlisted ?? 0} note="Marked as of interest" />
        <StatCard label="Submitted to date" value={overview?.candidatesSubmitted ?? 0} note="Across all your roles" />
        <StatCard label="Declined" value={overview?.declined ?? 0} note="Passed on" />
      </div>
    </div>
  )
}
