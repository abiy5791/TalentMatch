import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { DashboardMetrics, Match, PlacementMetrics } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import {
  Alert, Avatar, Bar, Card, CardHead, EmptyState, Loading, StatCard,
  humanize, moneyK, pct, scoreTextColor, stageTone, toneFill,
} from '../components/ui'

interface PipelineSummary {
  candidates: Record<string, number>
  companies: Record<string, number>
}

interface RecentActivity {
  newCandidates: number
  newJobs: number
  newCompanies: number
  newPlacements: number
  period: string
}

/** One stage row of a pipeline breakdown, sized against the largest stage. */
function StageRow({ stage, count, max }: { stage: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-32 shrink-0 truncate text-sm text-ink-700">{humanize(stage)}</span>
      <Bar value={(count / max) * 100} tone={stageTone(stage)} className="flex-1" />
      <span className="w-8 shrink-0 text-right font-mono text-xs tnum text-ink-600">{count}</span>
    </div>
  )
}

export function DashboardPage() {
  const { can } = useAuth()
  // The API withholds fee totals without analytics:financials, so show a
  // metric this role can actually act on instead of an empty money tile.
  const canSeeFinancials = can(P.ANALYTICS_FINANCIALS)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null)
  const [recent, setRecent] = useState<RecentActivity | null>(null)
  const [placements, setPlacements] = useState<PlacementMetrics | null>(null)
  const [topMatches, setTopMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [m, p, r, pm, matches] = await Promise.all([
          api.get<DashboardMetrics>('/analytics/dashboard'),
          api.get<PipelineSummary>('/analytics/pipeline'),
          api.get<RecentActivity>('/analytics/recent-activity', { days: 7 }),
          api.get<PlacementMetrics>('/analytics/placements'),
          api.get<Match[]>('/matches', { limit: 5 }),
        ])
        setMetrics(m)
        setPipeline(p)
        setRecent(r)
        setPlacements(pm)
        setTopMatches(matches.slice(0, 5))
        setError('')
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load dashboard')
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Loading label="Loading dashboard" />

  const candidateStages = Object.entries(pipeline?.candidates || {})
  const companyStages = Object.entries(pipeline?.companies || {})
  const candidateMax = Math.max(1, ...candidateStages.map(([, n]) => n))
  const companyMax = Math.max(1, ...companyStages.map(([, n]) => n))

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      {/* ---- Headline counts ---- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Candidates" value={metrics?.totalCandidates ?? 0} note="In the talent pool" to="/candidates" />
        <StatCard label="Live roles" value={metrics?.activeJobs ?? 0} note={`${metrics?.totalJobs ?? 0} total postings`} to="/jobs" />
        <StatCard label="Companies" value={metrics?.totalCompanies ?? 0} note="Client accounts" to="/companies" />
        <StatCard label="Placements" value={metrics?.totalPlacements ?? 0} note="Closed deals" to="/placements" />
      </div>

      {/* ---- Commercial performance ---- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Placement rate"
          value={placements?.successRate ?? 0}
          unit="%"
          note={`${placements?.placed ?? 0} placed of ${placements?.sentToClient ?? 0} sent to clients`}
        />
        {canSeeFinancials ? (
          <StatCard
            label="Fees booked"
            value={moneyK(placements?.totalFees, placements?.currency)}
            note={`Across ${placements?.totalPlacements ?? 0} placements`}
          />
        ) : (
          <StatCard
            label="Sent to clients"
            value={placements?.sentToClient ?? 0}
            note="Candidates dispatched for review"
          />
        )}
        <StatCard
          label="Client satisfaction"
          value={placements?.avgSatisfaction ?? 0}
          unit="/ 5"
          note="Average placement rating"
        />
      </div>

      {/* ---- Pipelines ---- */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Candidate pipeline"
            subtitle="Talent by current lifecycle stage"
            action={
              <Link to="/pipeline" className="text-xs font-medium text-accent-600 hover:text-accent-700">
                Open board
              </Link>
            }
          />
          {candidateStages.length ? (
            <div className="divide-y divide-ink-200">
              {candidateStages.map(([stage, count]) => (
                <StageRow key={stage} stage={stage} count={count} max={candidateMax} />
              ))}
            </div>
          ) : (
            <EmptyState title="No candidate stages yet" hint="Stages appear as soon as candidates enter the pipeline." />
          )}
        </Card>

        <Card>
          <CardHead
            title="Company pipeline"
            subtitle="Client accounts by stage"
            action={
              <Link to="/companies" className="text-xs font-medium text-accent-600 hover:text-accent-700">
                View all
              </Link>
            }
          />
          {companyStages.length ? (
            <div className="divide-y divide-ink-200">
              {companyStages.map(([stage, count]) => (
                <StageRow key={stage} stage={stage} count={count} max={companyMax} />
              ))}
            </div>
          ) : (
            <EmptyState title="No company stages yet" hint="Add a client account to start tracking its lifecycle." />
          )}
        </Card>
      </div>

      {/* ---- Top matches + recent activity ---- */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Top matches"
            subtitle="Highest weighted candidate–role scores"
            action={
              <Link to="/matching" className="text-xs font-medium text-accent-600 hover:text-accent-700">
                View all
              </Link>
            }
          />
          {topMatches.length ? (
            <div className="divide-y divide-ink-200">
              {topMatches.map(m => {
                const name = `${m.candidate?.firstName || ''} ${m.candidate?.lastName || ''}`.trim()
                const score = Math.round(Number(m.overallScore) || 0)
                return (
                  <Link
                    key={m.id}
                    to="/matching"
                    className="flex items-center gap-3 px-4 py-3 transition-colors duration-base ease-out hover:bg-ink-50"
                  >
                    <Avatar name={name || '—'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{name || 'Unnamed candidate'}</p>
                      <p className="truncate text-xs text-ink-500">
                        {m.job?.title} · {m.job?.company?.name}
                      </p>
                    </div>
                    <span className={`font-mono text-base font-medium tnum ${scoreTextColor(score)}`}>
                      {pct(score)}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </Link>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="No match scores yet"
              hint="Run a calculation from the Matching screen to score the current talent pool."
            />
          )}
        </Card>

        <Card>
          <CardHead title="Recent activity" subtitle={`New records in the last ${recent?.period || '7d'}`} />
          <div className="grid grid-cols-2 gap-px bg-ink-200">
            {[
              { label: 'Candidates', value: recent?.newCandidates ?? 0, to: '/candidates', tone: 'success' as const },
              { label: 'Jobs', value: recent?.newJobs ?? 0, to: '/jobs', tone: 'info' as const },
              { label: 'Companies', value: recent?.newCompanies ?? 0, to: '/companies', tone: 'neutral' as const },
              { label: 'Placements', value: recent?.newPlacements ?? 0, to: '/placements', tone: 'accent' as const },
            ].map(item => (
              <Link
                key={item.label}
                to={item.to}
                className="group bg-white px-4 py-4 transition-colors duration-base ease-out hover:bg-ink-50"
              >
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${toneFill[item.tone]}`} />
                  <span className="eyebrow">{item.label}</span>
                  <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-ink-300 transition-colors duration-base ease-out group-hover:text-ink-500" />
                </span>
                <p className="mt-2 font-mono text-xl font-medium tnum text-ink-900">{item.value}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
