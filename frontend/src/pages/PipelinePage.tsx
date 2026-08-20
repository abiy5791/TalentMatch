import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { PipelineEntry } from '../types'
import { useHeaderActions } from '../components/HeaderActions'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import { Alert, Avatar, Card, EmptyState, Loading, Segmented, humanize, stageTone, toneFill } from '../components/ui'

type Tab = 'CANDIDATE' | 'COMPANY' | 'PLACEMENT'

const TABS: { value: Tab; label: string }[] = [
  { value: 'CANDIDATE', label: 'Candidates' },
  { value: 'COMPANY', label: 'Companies' },
  { value: 'PLACEMENT', label: 'Placements' },
]

const ORDER: Record<Tab, string[]> = {
  CANDIDATE: ['UNASSIGNED', 'SCREENING', 'MATCHED', 'SENT_TO_COMPANY', 'INTERVIEWING', 'OFFERED', 'PLACED', 'REJECTED', 'ARCHIVED'],
  COMPANY: ['LEAD', 'ONBOARDED', 'ACTIVE', 'FULFILLED', 'INACTIVE', 'REJECTED'],
  PLACEMENT: ['ACTIVE', 'COMPLETED', 'TERMINATED', 'ARCHIVED'],
}

export function PipelinePage() {
  const { can } = useAuth()
  const [tab, setTab] = useState<Tab>('CANDIDATE')
  const [entries, setEntries] = useState<PipelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const canTransition = can(P.PIPELINE_TRANSITION)

  const load = useCallback(async (type: Tab) => {
    setLoading(true)
    try {
      setEntries(await api.get<PipelineEntry[]>(`/pipeline/${type}`))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load pipeline')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(tab) }, [load, tab])

  useHeaderActions(
    <Segmented value={tab} options={TABS} onChange={setTab} />,
    [tab],
  )

  const move = async (entry: PipelineEntry, stage: string) => {
    setBusyId(entry.id)
    setError('')
    try {
      await api.post('/pipeline/transition', {
        entityType: tab,
        entityId: entry.entityId,
        stage,
        notes: `Moved to ${stage} from the pipeline board`,
      })
      await load(tab)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Transition rejected')
    }
    setBusyId(null)
  }

  // Columns keep the lifecycle order even when a stage is empty, so the board
  // reads as the state machine it mirrors.
  const columns = ORDER[tab].map(stage => ({
    stage,
    items: entries.filter(e => e.stage === stage),
  }))
  const hasAny = entries.length > 0

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}

      <p className="text-xs text-ink-500">
        Stage transitions are validated against the lifecycle state machine — only permitted next stages are offered.
      </p>

      {loading ? (
        <Loading label="Loading pipeline" />
      ) : !hasAny ? (
        <Card>
          <EmptyState
            title="Nothing in this pipeline yet"
            hint={`No ${tab.toLowerCase()} records have entered a stage so far.`}
          />
        </Card>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:px-0">
          {columns.map(({ stage, items }) => (
            <div key={stage} className="card flex w-[262px] shrink-0 flex-col self-start">
              <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${toneFill[stageTone(stage)]}`} />
                  <span className="text-xs font-semibold text-ink-900">{humanize(stage)}</span>
                </span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-2xs tnum text-ink-500">
                  {items.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 p-2.5">
                {items.map(item => (
                  <div key={item.id} className="rounded-sm border border-ink-200 bg-white p-2.5">
                    <div className="flex items-start gap-2">
                      <Avatar name={item.entityName || '—'} size={24} />
                      <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink-900">{item.entityName}</p>
                      {busyId === item.id && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-400" />}
                    </div>

                    {item.previousStage && (
                      <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-500">
                        <span className="truncate">{humanize(item.previousStage)}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-ink-300" />
                        <span className="truncate font-medium text-ink-700">{humanize(item.stage)}</span>
                      </p>
                    )}

                    {item.notes && <p className="mt-2 line-clamp-2 text-2xs text-ink-500">{item.notes}</p>}

                    <div className="mt-2 flex items-center justify-between gap-2 font-mono text-2xs text-ink-400">
                      <span className="truncate">
                        {item.changedBy ? `${item.changedBy.firstName} ${item.changedBy.lastName}` : 'System'}
                      </span>
                      <span className="shrink-0">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    {canTransition && item.nextStages?.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1 border-t border-ink-200 pt-2.5">
                        {item.nextStages.map(next => (
                          <button
                            key={next}
                            onClick={() => move(item, next)}
                            disabled={busyId === item.id}
                            className="rounded-xs bg-ink-100 px-2 py-1 text-2xs font-medium text-ink-600
                              transition-colors duration-base ease-out hover:bg-ink-200 hover:text-ink-900
                              disabled:opacity-50"
                          >
                            → {humanize(next)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {!items.length && (
                  <p className="rounded-sm border border-dashed border-ink-300 px-3 py-4 text-center text-2xs text-ink-400">
                    Nothing in this stage
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
