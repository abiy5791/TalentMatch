import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Send, Check } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { Job, Match } from '../types'
import { Modal, Field, inputClass } from '../components/Modal'
import { useHeaderActions } from '../components/HeaderActions'
import { useAuth } from '../contexts/AuthContext'
import { PERMISSIONS as P } from '../lib/permissions'
import {
  Alert, Avatar, Bar, Btn, Card, EmptyState, Loading, Toolbar, pct, scoreTextColor, scoreTone,
} from '../components/ui'

/** Cap the rendered set — the full list can run to thousands of pairings. */
const RENDER_LIMIT = 60

const FACTORS = [
  { key: 'skillMatchScore', label: 'Skills' },
  { key: 'experienceMatchScore', label: 'Experience' },
  { key: 'locationMatchScore', label: 'Location' },
  { key: 'salaryMatchScore', label: 'Salary' },
  { key: 'cultureMatchScore', label: 'Culture' },
] as const

export function MatchingPage() {
  const { can } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobFilter, setJobFilter] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [dispatchMessage, setDispatchMessage] = useState('')
  const [dispatching, setDispatching] = useState(false)

  const canCalculate = can(P.MATCHING_CALCULATE)
  const canDispatch = can(P.MATCHING_DISPATCH)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [matchData, jobData] = await Promise.all([
        api.get<Match[]>('/matches', { limit: 300 }),
        api.get<Job[]>('/jobs', { limit: 200 }),
      ])
      setMatches(matchData)
      setJobs(jobData)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load matches')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const recalculateAll = useCallback(async () => {
    setCalculating(true)
    setError('')
    setNotice('')
    try {
      const result = await api.post<{ calculated: number; candidates: number; jobs: number }>('/matches/calculate')
      setNotice(`Scored ${result.candidates} candidates against ${result.jobs} jobs (${result.calculated} match records).`)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to recalculate matches')
    }
    setCalculating(false)
  }, [load])

  const visible = useMemo(
    () =>
      matches.filter(
        m => (!jobFilter || m.job?.id === jobFilter) && (Number(m.overallScore) || 0) >= minScore,
      ),
    [matches, jobFilter, minScore],
  )

  // Dispatch targets a single job, so selection is scoped to the currently filtered job.
  const selectedMatches = visible.filter(m => selected.has(m.id))
  const dispatchJob = selectedMatches[0]?.job
  const sameJob = selectedMatches.every(m => m.job?.id === dispatchJob?.id)
  const selectedCount = selectedMatches.length

  useHeaderActions(
    <>
      {canDispatch && (
        <Btn
          variant="dark"
          icon={<Send className="h-4 w-4" />}
          onClick={() => setDispatchOpen(true)}
          disabled={!selectedCount || !sameJob}
          title={!sameJob ? 'Select candidates for a single job to dispatch' : undefined}
        >
          Dispatch{selectedCount ? ` (${selectedCount})` : ''}
        </Btn>
      )}
      {canCalculate && (
        <Btn variant="primary" onClick={recalculateAll} loading={calculating} icon={<RefreshCw className="h-4 w-4" />}>
          <span className="hidden sm:inline">{calculating ? 'Calculating…' : 'Recalculate all'}</span>
          <span className="sm:hidden">{calculating ? '…' : 'Rescore'}</span>
        </Btn>
      )}
    </>,
    [canDispatch, canCalculate, selectedCount, sameJob, calculating, recalculateAll],
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dispatch = async () => {
    if (!dispatchJob) return
    setDispatching(true)
    setError('')
    try {
      const result = await api.post<{ dispatchedCount: number; advancedCount: number }>('/matches/dispatch', {
        jobId: dispatchJob.id,
        candidateIds: selectedMatches.map(m => m.candidate.id),
        method: 'DASHBOARD',
        message: dispatchMessage || undefined,
      })
      setNotice(
        `Dispatched ${result.dispatchedCount} candidate(s) to ${dispatchJob.company?.name || 'the client'}; ` +
          `${result.advancedCount} moved to SENT TO COMPANY.`,
      )
      setSelected(new Set())
      setDispatchOpen(false)
      setDispatchMessage('')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Dispatch failed')
    }
    setDispatching(false)
  }

  const shown = visible.slice(0, RENDER_LIMIT)

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card className="px-4 py-3">
        <Toolbar className="gap-3">
          <select
            value={jobFilter}
            onChange={e => {
              setJobFilter(e.target.value)
              setSelected(new Set())
            }}
            className="select w-auto max-w-full"
          >
            <option value="">All jobs</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>
                {j.title} — {j.company?.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2.5 text-xs text-ink-600">
            <span className="eyebrow">Min score</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="h-1 w-28 cursor-pointer accent-accent-500"
            />
            <span className="w-9 font-mono text-xs tnum text-ink-900">{minScore}%</span>
          </label>

          <span className="ml-auto text-xs text-ink-500">
            {visible.length} {visible.length === 1 ? 'match' : 'matches'}
            {visible.length > RENDER_LIMIT && ` · showing top ${RENDER_LIMIT}`}
          </span>
        </Toolbar>
      </Card>

      {loading ? (
        <Loading label="Loading matches" />
      ) : shown.length ? (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(m => {
            const score = Math.round(Number(m.overallScore) || 0)
            const name = `${m.candidate?.firstName || ''} ${m.candidate?.lastName || ''}`.trim() || 'Unnamed candidate'
            const isSelected = selected.has(m.id)
            return (
              <Card
                key={m.id}
                className={`p-4 transition-colors duration-base ease-out
                  ${isSelected ? 'border-accent-300 bg-accent-50/40' : 'hover:border-ink-300'}`}
              >
                <div className="flex items-start gap-3">
                  {canDispatch && (
                    <button
                      onClick={() => toggle(m.id)}
                      aria-label={isSelected ? `Deselect ${name}` : `Select ${name}`}
                      className={`mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-xs border
                        transition-colors duration-base ease-out
                        ${isSelected
                          ? 'border-accent-500 bg-accent-500 text-white'
                          : 'border-ink-300 bg-white text-transparent hover:border-ink-400'}`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </button>
                  )}
                  <Avatar name={name} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{name}</p>
                    <p className="truncate text-xs text-ink-500">{m.candidate?.currentTitle || 'Title not set'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-mono text-xl font-medium tnum ${scoreTextColor(score)}`}>{score}</p>
                    <p className="eyebrow mt-0.5">match</p>
                  </div>
                </div>

                <p className="mt-3 truncate border-t border-ink-200 pt-3 text-xs text-ink-600">
                  <span className="text-ink-400">for </span>
                  {m.job?.title}
                  <span className="text-ink-400"> · {m.job?.company?.name}</span>
                </p>

                <div className="mt-3 space-y-2">
                  {FACTORS.map(f => {
                    const value = Math.round(Number(m[f.key]) || 0)
                    return (
                      <div key={f.key} className="flex items-center gap-2.5">
                        <span className="w-[74px] shrink-0 text-xs text-ink-500">{f.label}</span>
                        <Bar value={value} tone={scoreTone(value)} className="flex-1" />
                        <span className="w-7 shrink-0 text-right font-mono text-2xs tnum text-ink-600">{value}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title={matches.length ? 'No matches pass these filters' : 'No match scores yet'}
            hint={
              matches.length
                ? 'Lower the minimum score or pick a different job.'
                : 'Run “Recalculate all” to score the current talent pool against live roles.'
            }
            action={
              matches.length ? (
                <Btn
                  onClick={() => {
                    setMinScore(0)
                    setJobFilter('')
                  }}
                >
                  Reset filters
                </Btn>
              ) : canCalculate ? (
                <Btn variant="primary" onClick={recalculateAll} loading={calculating} icon={<RefreshCw className="h-4 w-4" />}>
                  Recalculate all
                </Btn>
              ) : undefined
            }
          />
        </Card>
      )}

      <Modal
        open={dispatchOpen}
        title="Dispatch candidates"
        description={dispatchJob ? `${dispatchJob.title} · ${dispatchJob.company?.name}` : ''}
        onClose={() => setDispatchOpen(false)}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setDispatchOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={dispatch} loading={dispatching}>
              {dispatching ? 'Dispatching…' : `Dispatch ${selectedCount}`}
            </Btn>
          </>
        }
      >
        <p className="eyebrow mb-2">Shortlist</p>
        <ul className="mb-5 divide-y divide-ink-200 overflow-hidden rounded-sm border border-ink-200">
          {selectedMatches.map(m => {
            const score = Math.round(Number(m.overallScore) || 0)
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-sm">
                <span className="truncate text-ink-800">
                  {m.candidate?.firstName} {m.candidate?.lastName}
                </span>
                <span className={`font-mono text-xs tnum ${scoreTextColor(score)}`}>{pct(score)}</span>
              </li>
            )
          })}
        </ul>
        <Field label="Message to the client" hint="Optional — included in the dashboard notification.">
          <textarea
            rows={3}
            className={inputClass}
            value={dispatchMessage}
            onChange={e => setDispatchMessage(e.target.value)}
            placeholder="Shortlisted against your must-have skills…"
          />
        </Field>
      </Modal>
    </div>
  )
}
