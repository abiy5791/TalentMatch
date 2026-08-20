import { useCallback, useEffect, useState } from 'react'
import {
  BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { DashboardMetrics, GapRow, PlacementMetrics } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useHeaderActions } from '../components/HeaderActions'
import { PERMISSIONS as P } from '../lib/permissions'
import {
  Alert, Bar, Card, CardHead, EmptyState, Loading, Pill, Segmented, StatCard,
  humanize, money, moneyK, stageTone, toneFill,
} from '../components/ui'

/* ---- Chart theme --------------------------------------------- */
/**
 * Categorical slots, assigned in fixed order so a tier keeps its hue no matter
 * how the data sorts. Validated with the dataviz palette checker (light surface):
 * lightness band, chroma floor, CVD separation and normal-vision floor all pass.
 * Orange sits below 3:1 against white, which the labelled legend beside the chart
 * relieves. Company tiers only ever number three; the fourth slot is headroom.
 */
const SERIES = ['#FF6B35', '#2F5FA8', '#2E7D4F', '#7A5AA8']

/** Single-series marks: neutral ink, with accent reserved for emphasis. */
const MARK = '#1F1E1A'
const MARK_ACCENT = '#FF6B35'
const MARK_WARN = '#B57C1B'

const GRID = '#E7E6E3'
const AXIS = { fontSize: 11, fill: '#78776F', fontFamily: 'JetBrains Mono, monospace' }
/** Fixed so stacked small multiples share an identical plot area. */
const Y_AXIS_WIDTH = 52
const CHART_MARGIN = { top: 4, right: 12, bottom: 0, left: 0 }
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid #E7E6E3',
  boxShadow: '0 12px 24px -8px rgba(10,10,9,0.12)',
  fontSize: 12,
  fontFamily: 'Inter, sans-serif',
  padding: '8px 10px',
}

/** Industry benchmark drawn as a reference line on time-to-fill. */
const TIME_TO_FILL_TARGET = 30

/**
 * The candidate lifecycle in order. Counts are *current* stage occupancy, so the
 * funnel is built cumulatively — "at or past this stage" — which is accurate for
 * a linear pipeline. REJECTED and ARCHIVED are terminal exits and sit outside it.
 */
const FUNNEL = [
  { stage: 'UNASSIGNED', label: 'In pool' },
  { stage: 'SCREENING', label: 'Screening' },
  { stage: 'MATCHED', label: 'Matched' },
  { stage: 'SENT_TO_COMPANY', label: 'Sent to client' },
  { stage: 'INTERVIEWING', label: 'Interviewing' },
  { stage: 'OFFERED', label: 'Offered' },
  { stage: 'PLACED', label: 'Placed' },
]

const RANGES = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
]

interface TierRow { tier: string; count: number }
interface TimeToFillRow { industry: string; avg_days: number; placements: number }
interface RevenueClientRow { company: string; tier: string; placements: number; fees: number }
interface RevenueMonthRow { month: string; placements: number; fees: number }
interface PipelineSummary { candidates: Record<string, number>; companies: Record<string, number> }
interface RecentActivity {
  newCandidates: number
  newJobs: number
  newCompanies: number
  newPlacements: number
  period: string
}

/** '2026-08' → 'Aug 26' */
const monthLabel = (month: string) => {
  const [y, m] = month.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return `${date.toLocaleString('en-US', { month: 'short' })} ${y.slice(2)}`
}

export function AnalyticsPage() {
  const { can } = useAuth()
  const canSeeFinancials = can(P.ANALYTICS_FINANCIALS)

  const [gapData, setGapData] = useState<GapRow[]>([])
  const [tierData, setTierData] = useState<TierRow[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [placements, setPlacements] = useState<PlacementMetrics | null>(null)
  const [timeToFill, setTimeToFill] = useState<TimeToFillRow[]>([])
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null)
  const [byClient, setByClient] = useState<RevenueClientRow[]>([])
  const [byMonth, setByMonth] = useState<RevenueMonthRow[]>([])
  const [feeCurrency, setFeeCurrency] = useState<string | undefined>()
  const [activity, setActivity] = useState<RecentActivity | null>(null)
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [gap, tier, dash, placementMetrics, ttf, pipe] = await Promise.all([
          api.get<GapRow[]>('/analytics/gap-analysis'),
          api.get<TierRow[]>('/analytics/tier-distribution'),
          api.get<DashboardMetrics>('/analytics/dashboard'),
          api.get<PlacementMetrics>('/analytics/placements'),
          api.get<TimeToFillRow[]>('/analytics/time-to-fill'),
          api.get<PipelineSummary>('/analytics/pipeline'),
        ])
        setGapData(gap)
        setTierData(tier)
        setMetrics(dash)
        setPlacements(placementMetrics)
        setTimeToFill(ttf)
        setPipeline(pipe)
        setError('')
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load analytics')
      }
      setLoading(false)
    }
    load()
  }, [])

  // Revenue is a separate permission — fetched on its own so a 403 here never
  // blanks the operational half of the page.
  useEffect(() => {
    if (!canSeeFinancials) return
    api
      .get<{ byClient: RevenueClientRow[]; byMonth: RevenueMonthRow[]; currency?: string }>('/analytics/revenue')
      .then(r => {
        setByClient(r.byClient || [])
        setByMonth(r.byMonth || [])
        setFeeCurrency(r.currency)
      })
      .catch(() => undefined)
  }, [canSeeFinancials])

  const loadActivity = useCallback(async (period: string) => {
    try {
      setActivity(await api.get<RecentActivity>('/analytics/recent-activity', { days: period }))
    } catch {
      setActivity(null)
    }
  }, [])

  useEffect(() => { loadActivity(days) }, [loadActivity, days])

  useHeaderActions(
    <Segmented value={days} options={RANGES} onChange={setDays} />,
    [days],
  )

  if (loading) return <Loading label="Loading analytics" />

  /* ---- Derived figures ---------------------------------------- */
  const stageCounts = pipeline?.candidates || {}

  // Cumulative occupancy: everyone at this stage or any later one.
  const funnel = FUNNEL.map((step, i) => {
    const reached = FUNNEL.slice(i).reduce((sum, s) => sum + (stageCounts[s.stage] || 0), 0)
    return { ...step, reached, current: stageCounts[step.stage] || 0 }
  })
  const funnelTop = funnel[0]?.reached || 0
  const exited = (stageCounts.REJECTED || 0) + (stageCounts.ARCHIVED || 0)

  const totalTtfPlacements = timeToFill.reduce((sum, r) => sum + r.placements, 0)
  const weightedTtf = totalTtfPlacements
    ? Math.round(
        (timeToFill.reduce((sum, r) => sum + r.avg_days * r.placements, 0) / totalTtfPlacements) * 10,
      ) / 10
    : 0
  const ttfDelta = weightedTtf ? Math.round((weightedTtf - TIME_TO_FILL_TARGET) * 10) / 10 : 0

  const criticalSkills = gapData.filter(g => g.severity === 'CRITICAL').length
  const tierTotal = tierData.reduce((sum, t) => sum + t.count, 0)

  const totalFees = byClient.reduce((sum, c) => sum + c.fees, 0)
  const topClientShare = totalFees && byClient.length ? Math.round((byClient[0].fees / totalFees) * 100) : 0
  const maxClientFee = Math.max(1, ...byClient.map(c => c.fees))

  const monthly = byMonth.map(r => ({ ...r, label: monthLabel(r.month) }))
  const lastMonth = monthly[monthly.length - 1]
  const prevMonth = monthly[monthly.length - 2]
  const monthDelta =
    lastMonth && prevMonth && prevMonth.fees
      ? Math.round(((lastMonth.fees - prevMonth.fees) / prevMonth.fees) * 100)
      : null

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}

      {/* ---- Headline KPIs ---- */}
      <div className={`grid gap-3 sm:grid-cols-2 ${canSeeFinancials ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        <StatCard
          label="Placement rate"
          value={placements?.successRate ?? 0}
          unit="%"
          note={`${placements?.placed ?? 0} placed of ${placements?.sentToClient ?? 0} sent to clients`}
        />
        <StatCard
          label="Placements"
          value={placements?.totalPlacements ?? 0}
          note={`${metrics?.activeJobs ?? 0} roles live now`}
        />
        <StatCard
          label="Avg time to fill"
          value={weightedTtf || '—'}
          unit={weightedTtf ? 'days' : ''}
          note={
            weightedTtf ? (
              <span className={ttfDelta > 0 ? 'text-danger-500' : 'text-success-500'}>
                {ttfDelta > 0 ? `${ttfDelta}d over` : `${Math.abs(ttfDelta)}d under`} the {TIME_TO_FILL_TARGET}-day target
              </span>
            ) : (
              'No completed placements yet'
            )
          }
        />
        {canSeeFinancials && (
          <StatCard
            label="Fees booked"
            value={moneyK(placements?.totalFees, placements?.currency)}
            note={
              monthDelta === null ? (
                'Recognised placement fees'
              ) : (
                <span className={`inline-flex items-center gap-1 ${monthDelta >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                  {monthDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(monthDelta)}% vs. previous month
                </span>
              )
            }
          />
        )}
        <StatCard
          label="Client satisfaction"
          value={placements?.avgSatisfaction || '—'}
          unit={placements?.avgSatisfaction ? '/ 5' : ''}
          note="Average placement rating"
        />
      </div>

      {/* ---- Funnel + talent gap ---- */}
      <div className="grid gap-3.5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHead
            title="Conversion funnel"
            subtitle="Candidates currently at or past each stage"
          />
          {funnelTop ? (
            <>
              <div className="px-4 py-3.5">
                {funnel.map((step, i) => {
                  const share = funnelTop ? (step.reached / funnelTop) * 100 : 0
                  const prev = funnel[i - 1]
                  const conversion = prev?.reached ? Math.round((step.reached / prev.reached) * 100) : null
                  return (
                    <div key={step.stage}>
                      {conversion !== null && (
                        <div className="flex items-center gap-2 py-1 pl-1">
                          <span className="h-3 w-px bg-ink-200" />
                          <span
                            className={`font-mono text-2xs tnum ${
                              conversion >= 60 ? 'text-ink-400' : 'text-warning-700'
                            }`}
                          >
                            ↓ {conversion}%
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="text-sm text-ink-700">{step.label}</span>
                          <span className="font-mono text-2xs tnum text-ink-500">
                            {step.reached} · {Math.round(share)}%
                          </span>
                        </div>
                        {/* One measure across ordered stages, so one colour for
                            every step — the terminal outcome takes the accent. */}
                        <div className="h-2 w-full overflow-hidden rounded-xs bg-ink-100">
                          <div
                            className={`h-full rounded-xs transition-[width] duration-slow ease-out ${
                              step.stage === 'PLACED' ? 'bg-accent-500' : 'bg-ink-800'
                            }`}
                            style={{ width: `${Math.max(share, 1.5)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between border-t border-ink-200 px-4 py-2.5 text-xs">
                <span className="text-ink-500">End-to-end conversion</span>
                <span className="font-mono tnum font-medium text-ink-900">
                  {funnelTop ? Math.round(((stageCounts.PLACED || 0) / funnelTop) * 100) : 0}%
                  {exited > 0 && <span className="ml-2 font-normal text-ink-400">{exited} exited</span>}
                </span>
              </div>
            </>
          ) : (
            <EmptyState title="No pipeline data yet" hint="The funnel builds as candidates move through stages." />
          )}
        </Card>

        <Card className="overflow-hidden lg:col-span-3">
          <CardHead
            title="Talent gap analysis"
            subtitle="Live roles requiring a skill vs. candidates in play carrying it"
            action={
              criticalSkills > 0 ? (
                <Pill tone="danger">{criticalSkills} critical</Pill>
              ) : gapData.length ? (
                <Pill tone="success">Supply healthy</Pill>
              ) : undefined
            }
          />
          {gapData.length ? (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 border-b border-ink-200 bg-white">
                  <tr>
                    <th className="th">Skill</th>
                    <th className="th text-right">Demand</th>
                    <th className="th text-right">Supply</th>
                    <th className="th w-24">Coverage</th>
                    <th className="th text-right">Gap</th>
                    <th className="th">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200">
                  {gapData.map((row, i) => {
                    const coverage = row.job_count
                      ? Math.min(100, (row.candidate_count / row.job_count) * 100)
                      : 100
                    return (
                      <tr key={`${row.skill}-${i}`} className="transition-colors duration-base ease-out hover:bg-ink-50">
                        <td className="td font-medium text-ink-900">{row.skill}</td>
                        <td className="td text-right font-mono text-xs tnum">{row.job_count}</td>
                        <td className="td text-right font-mono text-xs tnum">{row.candidate_count}</td>
                        <td className="td">
                          <Bar value={coverage} tone={stageTone(row.severity)} />
                        </td>
                        <td
                          className={`td text-right font-mono text-xs tnum ${
                            row.gap > 0 ? 'text-danger-500' : 'text-ink-400'
                          }`}
                        >
                          {row.gap > 0 ? `+${row.gap}` : row.gap}
                        </td>
                        <td className="td">
                          <Pill tone={stageTone(row.severity)}>{row.severity}</Pill>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No live roles to analyse" hint="Publish a job to see which skills are under-supplied." />
          )}
        </Card>
      </div>

      {/* ---- Revenue trend (financials only) ---- */}
      {canSeeFinancials && (
        <Card>
          <CardHead
            title="Fee revenue by month"
            subtitle="Booked placement fees against placement volume"
            action={
              lastMonth ? (
                <span className="font-mono text-xs tnum text-ink-500">
                  {lastMonth.label} · {money(lastMonth.fees, feeCurrency)}
                </span>
              ) : undefined
            }
          />
          {monthly.length ? (
            /* Two stacked single-measure panels rather than one dual-axis plot:
               a shared y-scale for fees and volume would invent a correlation.
               Identical margins and y-axis width keep the plot areas aligned. */
            <div className="px-2 pb-2 pt-3">
              <p className="eyebrow mb-1" style={{ paddingLeft: Y_AXIS_WIDTH }}>
                Fees booked
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={CHART_MARGIN}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={false} axisLine={{ stroke: GRID }} height={2} />
                    <YAxis
                      width={Y_AXIS_WIDTH}
                      tick={AXIS}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => (v ? moneyK(v, feeCurrency) : '0')}
                    />
                    <Tooltip
                      cursor={{ fill: '#F4F4F2' }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [money(value, feeCurrency), 'Fees booked']}
                    />
                    <RBar dataKey="fees" fill={MARK} radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="eyebrow mb-1 mt-2" style={{ paddingLeft: Y_AXIS_WIDTH }}>
                Placements
              </p>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={CHART_MARGIN}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                    <YAxis
                      width={Y_AXIS_WIDTH}
                      tick={AXIS}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#F4F4F2' }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [value, 'Placements']}
                    />
                    <RBar dataKey="placements" fill={MARK_ACCENT} radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <EmptyState title="No fee history yet" hint="Revenue trend appears once placements are recorded." />
          )}
        </Card>
      )}

      {/* ---- Client mix ---- */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        {canSeeFinancials && (
          <Card className="overflow-hidden">
            <CardHead
              title="Top clients by fee"
              subtitle="Revenue concentration across accounts"
              action={
                topClientShare > 0 ? (
                  <Pill tone={topClientShare >= 40 ? 'warning' : 'neutral'}>{topClientShare}% top account</Pill>
                ) : undefined
              }
            />
            {byClient.length ? (
              <div className="max-h-[340px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 border-b border-ink-200 bg-white">
                    <tr>
                      <th className="th">Client</th>
                      <th className="th text-right">Placed</th>
                      <th className="th w-28">Fees</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-200">
                    {byClient.map(row => (
                      <tr key={row.company} className="transition-colors duration-base ease-out hover:bg-ink-50">
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-ink-900">{row.company}</span>
                            <Pill tone={row.tier === 'VIP' ? 'accent' : row.tier === 'RETAINER' ? 'success' : 'neutral'}>
                              {row.tier}
                            </Pill>
                          </div>
                        </td>
                        <td className="td text-right font-mono text-xs tnum">{row.placements}</td>
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <Bar value={(row.fees / maxClientFee) * 100} tone="accent" className="flex-1" />
                            <span className="w-14 shrink-0 text-right font-mono text-2xs tnum text-ink-700">
                              {moneyK(row.fees, feeCurrency)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No client revenue yet" hint="Fees are attributed once a placement is recorded." />
            )}
          </Card>
        )}

        <Card className={canSeeFinancials ? '' : 'lg:col-span-2'}>
          <CardHead title="Client tier distribution" subtitle={`${tierTotal} accounts by commercial tier`} />
          {tierData.length ? (
            <div className="flex flex-col items-center gap-2 px-4 py-4 sm:flex-row">
              <div className="h-52 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="tier"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {tierData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={SERIES[index % SERIES.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2 sm:w-1/2">
                {tierData.map((row, i) => (
                  <li key={row.tier} className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-xs"
                      style={{ background: SERIES[i % SERIES.length] }}
                    />
                    <span className="flex-1 truncate text-sm text-ink-700">{humanize(row.tier)}</span>
                    <span className="font-mono text-xs tnum text-ink-900">{row.count}</span>
                    <span className="w-10 text-right font-mono text-2xs tnum text-ink-400">
                      {tierTotal ? Math.round((row.count / tierTotal) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title="No client accounts yet" hint="Tier mix appears once companies are added." />
          )}
        </Card>
      </div>

      {/* ---- Time to fill ---- */}
      <Card>
        <CardHead
          title="Time to fill by industry"
          subtitle={`Average days from posting to placement · dashed line marks the ${TIME_TO_FILL_TARGET}-day target`}
          action={
            totalTtfPlacements ? (
              <span className="font-mono text-xs tnum text-ink-500">{totalTtfPlacements} placements</span>
            ) : undefined
          }
        />
        {timeToFill.length ? (
          <>
            <div className="h-64 px-2 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeToFill} margin={CHART_MARGIN}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="industry" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis width={Y_AXIS_WIDTH} tick={AXIS} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: '#F4F4F2' }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _n, item: any) => [
                      `${v} days · ${item?.payload?.placements ?? 0} placements`,
                      'Avg time to fill',
                    ]}
                  />
                  <ReferenceLine
                    y={TIME_TO_FILL_TARGET}
                    stroke="#A8A7A3"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  {/* Threshold status, not a value ramp: over-target industries
                      carry the warning token, restated by the strip below. */}
                  <RBar dataKey="avg_days" radius={[3, 3, 0, 0]} maxBarSize={44}>
                    {timeToFill.map((row, i) => (
                      <Cell key={i} fill={row.avg_days > TIME_TO_FILL_TARGET ? MARK_WARN : MARK} />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-ink-200 px-4 py-3 text-xs">
              {timeToFill.map(row => (
                <span key={row.industry} className="flex items-center gap-1.5 text-ink-500">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      row.avg_days > TIME_TO_FILL_TARGET ? 'bg-warning-500' : 'bg-ink-800'
                    }`}
                  />
                  {row.industry}
                  <span className="font-mono tnum text-ink-900">{row.avg_days}d</span>
                  <span className="font-mono tnum text-ink-400">({row.placements})</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="No placements recorded yet" hint="Time to fill is derived from completed placements." />
        )}
      </Card>

      {/* ---- Volume snapshot ---- */}
      <Card>
        <CardHead
          title="New records"
          subtitle={`Created in the last ${activity?.period || `${days}d`}`}
        />
        <div className="grid grid-cols-2 gap-px bg-ink-200 sm:grid-cols-4">
          {[
            { label: 'Candidates', value: activity?.newCandidates ?? 0, total: metrics?.totalCandidates ?? 0, tone: 'success' as const },
            { label: 'Jobs', value: activity?.newJobs ?? 0, total: metrics?.totalJobs ?? 0, tone: 'info' as const },
            { label: 'Companies', value: activity?.newCompanies ?? 0, total: metrics?.totalCompanies ?? 0, tone: 'neutral' as const },
            { label: 'Placements', value: activity?.newPlacements ?? 0, total: metrics?.totalPlacements ?? 0, tone: 'accent' as const },
          ].map(item => (
            <div key={item.label} className="bg-white px-4 py-4">
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${toneFill[item.tone]}`} />
                <span className="eyebrow">{item.label}</span>
              </span>
              <p className="mt-2 font-mono text-xl font-medium tnum text-ink-900">{item.value}</p>
              <p className="mt-1 text-2xs text-ink-400">
                {item.total ? `${Math.round((item.value / item.total) * 100)}% of ${item.total} total` : 'No records'}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
