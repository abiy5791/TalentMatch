import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import { Alert, Bar, Btn, Card, CardHead, Loading, Pill } from './ui'

const FACTORS = [
  { key: 'skills', label: 'Skills', hint: 'Required skills present, and at the level asked for' },
  { key: 'experience', label: 'Experience', hint: 'Years of experience against the seniority of the role' },
  { key: 'location', label: 'Location', hint: 'City and country fit, relaxed for remote roles' },
  { key: 'salary', label: 'Salary', hint: 'Expectation against the advertised band' },
  { key: 'culture', label: 'Culture', hint: 'Overlap with the client’s culture tags' },
  { key: 'availability', label: 'Availability', hint: 'Notice period against how soon the client needs someone' },
] as const

type FactorKey = (typeof FACTORS)[number]['key']
type Weights = Record<FactorKey, number>

interface WeightsResponse {
  weights: Weights
  normalized: Weights
  defaults: Weights
  isDefault: boolean
  algorithmVersion: string
  updatedAt: string | null
  updatedBy: { id: string; firstName: string; lastName: string } | null
  staleScores?: number
}

const equal = (a: Weights, b: Weights) => FACTORS.every(f => a[f.key] === b[f.key])

/**
 * Operator control over how a match score is composed. Weights are relative:
 * the API normalises them, so the share shown here is each value over the total
 * rather than a raw percentage that must add up to 100.
 */
export function MatchWeightsCard() {
  const { can } = useAuth()
  const canConfigure = can(P.MATCHING_CONFIGURE)
  const canCalculate = can(P.MATCHING_CALCULATE)

  const [data, setData] = useState<WeightsResponse | null>(null)
  const [draft, setDraft] = useState<Weights | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [stale, setStale] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<WeightsResponse>('/matches/weights')
      setData(res)
      setDraft(res.weights)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load scoring weights')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Card>
        <CardHead title="Match scoring weights" />
        <Loading label="Loading weights" />
      </Card>
    )
  }

  if (!data || !draft) {
    return (
      <Card>
        <CardHead title="Match scoring weights" />
        <div className="px-4 py-4">
          <Alert tone="danger">{error || 'Scoring weights are unavailable.'}</Alert>
        </div>
      </Card>
    )
  }

  const total = FACTORS.reduce((sum, f) => sum + (draft[f.key] || 0), 0)
  const share = (key: FactorKey) => (total > 0 ? ((draft[key] || 0) / total) * 100 : 0)
  const dirty = !equal(draft, data.weights)
  const atDefaults = equal(draft, data.defaults)

  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await api.put<WeightsResponse>('/matches/weights', draft)
      setData(res)
      setDraft(res.weights)
      setStale(res.staleScores || 0)
      setNotice('Scoring weights saved.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save weights')
    }
    setSaving(false)
  }

  const resetToDefaults = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await api.delete<WeightsResponse>('/matches/weights')
      setData(res)
      setDraft(res.weights)
      setStale(0)
      setNotice('Restored the shipped defaults.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to restore defaults')
    }
    setSaving(false)
  }

  const rescore = async () => {
    setRescoring(true)
    setError('')
    try {
      const res = await api.post<{ calculated: number }>('/matches/calculate')
      setStale(0)
      setNotice(`Rescored ${res.calculated} candidate–role pairs with the new weights.`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to recalculate matches')
    }
    setRescoring(false)
  }

  return (
    <Card className="overflow-hidden">
      <CardHead
        title="Match scoring weights"
        subtitle={
          canConfigure
            ? 'Relative weight of each factor when scoring a candidate against a role'
            : 'How each factor is weighted when scoring a candidate against a role'
        }
        action={
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs text-ink-400">{data.algorithmVersion}</span>
            <Pill tone={data.isDefault ? 'neutral' : 'accent'}>{data.isDefault ? 'Defaults' : 'Custom'}</Pill>
          </div>
        }
      />

      {(error || notice) && (
        <div className="border-b border-ink-200 px-4 py-3">
          {error ? <Alert tone="danger">{error}</Alert> : <Alert tone="success">{notice}</Alert>}
        </div>
      )}

      <div className="divide-y divide-ink-200">
        {FACTORS.map(f => (
          <div key={f.key} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink-900">{f.label}</span>
              <span className="shrink-0 font-mono text-xs tnum text-ink-900">{Math.round(share(f.key))}%</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-500">{f.hint}</p>

            {canConfigure ? (
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft[f.key]}
                  disabled={saving}
                  onChange={e => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
                  aria-label={`${f.label} weight`}
                  className="h-1 flex-1 cursor-pointer accent-accent-500"
                />
                <span className="w-9 shrink-0 text-right font-mono text-2xs tnum text-ink-500">
                  {draft[f.key]}
                </span>
              </div>
            ) : (
              <div className="mt-2">
                <Bar value={share(f.key)} tone={f.key === 'skills' ? 'accent' : 'neutral'} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 bg-ink-50 px-4 py-3">
        <p className="text-xs text-ink-500">
          {total <= 0 ? (
            <span className="text-danger-500">At least one factor must carry weight.</span>
          ) : data.updatedBy && data.updatedAt ? (
            <>
              Last changed by {data.updatedBy.firstName} {data.updatedBy.lastName} ·{' '}
              {new Date(data.updatedAt).toLocaleDateString()}
            </>
          ) : (
            'Using the shipped defaults.'
          )}
        </p>

        {canConfigure && (
          <div className="flex items-center gap-2">
            {dirty && (
              <Btn size="sm" variant="ghost" onClick={() => setDraft(data.weights)} disabled={saving}>
                Discard
              </Btn>
            )}
            <Btn
              size="sm"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={resetToDefaults}
              disabled={saving || (data.isDefault && atDefaults)}
            >
              Defaults
            </Btn>
            <Btn size="sm" variant="primary" onClick={save} loading={saving} disabled={!dirty || total <= 0}>
              Save weights
            </Btn>
          </div>
        )}
      </div>

      {/* Saving new weights does not touch scores already on record — say so
          plainly and offer the recalculation rather than implying it happened. */}
      {stale > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 bg-warning-50 px-4 py-3">
          <p className="text-xs text-warning-700">
            {stale.toLocaleString('en-US')} existing match {stale === 1 ? 'score was' : 'scores were'} calculated with
            the previous weights and are unchanged until you recalculate.
          </p>
          {canCalculate && (
            <Btn
              size="sm"
              variant="dark"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={rescore}
              loading={rescoring}
            >
              Recalculate now
            </Btn>
          )}
        </div>
      )}
    </Card>
  )
}
