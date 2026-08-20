import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { PERMISSIONS as P } from '../../lib/permissions'
import { PortalPlacement } from '../../types'
import { Modal, Field, inputClass } from '../../components/Modal'
import {
  Alert, Avatar, Btn, Card, CardHead, EmptyState, Loading, Pill, humanize, stageTone,
} from '../../components/ui'

export function PortalPlacementsPage() {
  const { can } = useAuth()
  const canRate = can(P.PORTAL_FEEDBACK_WRITE)
  const [placements, setPlacements] = useState<PortalPlacement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [active, setActive] = useState<PortalPlacement | null>(null)
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPlacements(await api.get<PortalPlacement[]>('/portal/placements'))
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load placements')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openFeedback = (p: PortalPlacement) => {
    setActive(p)
    setScore(p.satisfactionScore || 0)
    setComment(p.clientFeedback?.comment || '')
  }

  const save = async () => {
    if (!active) return
    setSaving(true)
    try {
      await api.patch(`/portal/placements/${active.id}/feedback`, {
        satisfactionScore: score || undefined,
        comment: comment || undefined,
      })
      setNotice('Thanks — your feedback has reached your account manager.')
      setActive(null)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your feedback')
    }
    setSaving(false)
  }

  if (loading) return <Loading label="Loading placements" />

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card className="overflow-hidden">
        <CardHead title="Your hires" subtitle="People placed with you through TalentMatch" />
        {placements.length ? (
          <div className="divide-y divide-ink-200">
            {placements.map(p => {
              const name = `${p.candidate?.firstName || ''} ${p.candidate?.lastName || ''}`.trim()
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <Avatar name={name || '—'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {p.job?.title}
                      {p.startDate ? ` · started ${new Date(p.startDate).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <Pill tone={stageTone(p.status)}>{humanize(p.status)}</Pill>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        className={`h-4 w-4 ${
                          (p.satisfactionScore || 0) >= n ? 'fill-warning-500 text-warning-500' : 'text-ink-300'
                        }`}
                      />
                    ))}
                  </div>
                  {canRate && (
                    <Btn size="sm" onClick={() => openFeedback(p)}>
                      {p.satisfactionScore ? 'Update' : 'Rate'}
                    </Btn>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState title="No placements yet" hint="Hires made through TalentMatch will appear here." />
        )}
      </Card>

      <Modal
        open={Boolean(active)}
        title="Rate this placement"
        description={
          active
            ? `${active.candidate?.firstName} ${active.candidate?.lastName} — ${active.job?.title}`
            : ''
        }
        onClose={() => setActive(null)}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setActive(null)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={save} disabled={!score}>
              Submit feedback
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="How is this hire working out?">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  aria-label={`${n} out of 5`}
                  className="rounded-sm p-1 transition-colors duration-base ease-out hover:bg-ink-100"
                >
                  <Star
                    className={`h-6 w-6 ${score >= n ? 'fill-warning-500 text-warning-500' : 'text-ink-300'}`}
                  />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Anything you would like us to know?" hint="Optional — shared with your account manager.">
            <textarea rows={4} className={inputClass} value={comment} onChange={e => setComment(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
