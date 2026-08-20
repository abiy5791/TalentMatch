import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Banknote, Briefcase, Building2, Check, Clock, FileText, Globe, Link2, MapPin,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { MyProfile, PublicJob, ResumeRef } from '../../types'
import { Modal, Field, inputClass, selectClass } from '../../components/Modal'
import { ResumeField } from '../../components/ResumeField'
import { Alert, Avatar, Btn, Card, CardHead, EmptyState, Loading, Pill, Tag, humanize, moneyK } from '../../components/ui'
import { PublicShell } from './PublicShell'

const emptyForm = {
  firstName: '', lastName: '', email: '', phone: '', city: '', country: '',
  currentTitle: '', currentCompany: '', experienceYears: '',
  salaryExpectationMin: '', availability: 'IMMEDIATE', skills: '', coverNote: '',
  password: '',
}

interface ApplyResult {
  applicationId: string
  jobTitle: string
  company: string
  accountCreated: boolean
  canTrack: boolean
}

/** Profile -> form. Everything an applicant would otherwise retype. */
function fromProfile(p: MyProfile) {
  return {
    ...emptyForm,
    firstName: p.firstName || '',
    lastName: p.lastName || '',
    email: p.email || '',
    phone: p.phone || '',
    city: p.location?.city || '',
    country: p.location?.country || '',
    currentTitle: p.currentTitle || '',
    currentCompany: p.currentCompany || '',
    experienceYears: p.experienceYears?.toString() || '',
    salaryExpectationMin: p.salaryExpectationMin?.toString() || '',
    availability: p.availability || 'IMMEDIATE',
    skills: (p.skills || []).map(s => s.skillName).join(', '),
  }
}

/* ---- Presentation helpers ------------------------------------ */

/** A one-sided band reads as broken, so say which side it is instead. */
function salaryLabel(job: PublicJob) {
  const { salaryMin: min, salaryMax: max, currency } = job
  if (min && max) return `${moneyK(min, currency)} – ${moneyK(max, currency)}`
  if (min) return `From ${moneyK(min, currency)}`
  if (max) return `Up to ${moneyK(max, currency)}`
  return 'Not disclosed'
}

function locationLabel(job: PublicJob) {
  const parts = [job.location?.city, job.location?.country].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Remote'
}

/** Freshness matters more to a jobseeker here than the calendar date. */
function postedLabel(iso?: string) {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days < 0) return null
  if (days === 0) return 'Posted today'
  if (days === 1) return 'Posted yesterday'
  if (days < 30) return `Posted ${days} days ago`
  const months = Math.max(1, Math.round(days / 30))
  return `Posted ${months} month${months === 1 ? '' : 's'} ago`
}

function CompanyMark({ name, logoUrl, size = 52 }: { name: string; logoUrl?: string; size?: number }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-md border border-ink-200 bg-white object-contain p-1.5"
      />
    )
  }
  return <Avatar name={name} size={size} rounded="md" />
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-white px-4 py-3">
      <span className="mt-[3px] shrink-0 text-ink-400">{icon}</span>
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-ink-900" title={value}>{value}</p>
      </div>
    </div>
  )
}

/** Neutral spine, single accent — no traffic-light ticks on a public page. */
function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-700">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function FormSection({ title }: { title: string }) {
  return (
    <div className="border-t border-ink-200 pt-4 first:border-0 first:pt-0 sm:col-span-2">
      <p className="eyebrow">{title}</p>
    </div>
  )
}

export function JobDetailPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [resume, setResume] = useState<ResumeRef | null>(null)
  const [result, setResult] = useState<ApplyResult | null>(null)

  // A signed-in applicant applies as themselves: identity comes from the token,
  // and the form starts from what we already hold rather than from nothing.
  const signedIn = user?.home === 'candidate'
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [prefilling, setPrefilling] = useState(false)

  useEffect(() => {
    api
      .get<PublicJob>(`/public/jobs/${slug}`)
      .then(setJob)
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load this role'))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  // Fetched when the form is opened, not on page load — a visitor only browsing
  // has no reason to trigger a profile read.
  useEffect(() => {
    if (!applyOpen || !signedIn || profile) return
    setPrefilling(true)
    api
      .get<MyProfile>('/me/profile')
      .then(p => {
        setProfile(p)
        setForm(fromProfile(p))
        setResume(p.resume || null)
      })
      .catch(() => undefined)
      .finally(() => setPrefilling(false))
  }, [applyOpen, signedIn, profile])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // Clipboard access can be refused outright; the URL is in the address bar.
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!job) return
    if (job.requiresResume && !resume) {
      setError('This role asks for a CV. Attach one before submitting.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = signedIn
        ? await applyAsCandidate(job.id)
        : await api.post<ApplyResult>('/public/applications', {
            jobId: job.id,
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone || undefined,
            location: form.city || form.country ? { city: form.city, country: form.country } : undefined,
            currentTitle: form.currentTitle || undefined,
            currentCompany: form.currentCompany || undefined,
            experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
            salaryExpectationMin: form.salaryExpectationMin ? Number(form.salaryExpectationMin) : undefined,
            availability: form.availability,
            skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
            coverNote: form.coverNote || undefined,
            password: form.password || undefined,
            resumeId: resume?.id,
          })
      setResult(res)
      setApplyOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit your application')
    }
    setSaving(false)
  }

  /**
   * Applying with an account. The prefilled fields are editable, so an edit has
   * to go somewhere — it updates the profile, which is where those details came
   * from. Sent only when something actually changed.
   */
  const applyAsCandidate = async (jobId: string): Promise<ApplyResult> => {
    const edited = profile && JSON.stringify(fromProfile(profile)) !== JSON.stringify({ ...form, coverNote: '', password: '' })
    if (edited) {
      await api.put<MyProfile>('/me/profile', {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        location: { city: form.city, country: form.country },
        currentTitle: form.currentTitle || undefined,
        currentCompany: form.currentCompany || undefined,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        salaryExpectationMin: form.salaryExpectationMin ? Number(form.salaryExpectationMin) : undefined,
        availability: form.availability,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      })
    }
    await api.post('/me/applications', {
      jobId,
      coverNote: form.coverNote || undefined,
      // Left out when it is the CV already on file — nothing to re-attach.
      resumeId: resume && resume.id !== profile?.resume?.id ? resume.id : undefined,
    })
    return {
      applicationId: '',
      jobTitle: job?.title || '',
      company: job?.company?.name || '',
      accountCreated: false,
      canTrack: true,
    }
  }

  if (loading) {
    return (
      <PublicShell eyebrow="Open role" title="Loading…">
        <Loading label="Loading role" />
      </PublicShell>
    )
  }

  if (!job) {
    return (
      <PublicShell eyebrow="Open role" title="Role not available">
        <Card>
          <EmptyState
            title={error || 'This role is no longer listed.'}
            hint="It may have been filled or withdrawn. The rest of the board is still open."
            action={
              <Link to="/careers" className="btn btn-md btn-primary">
                <ArrowLeft className="h-4 w-4" /> Back to all roles
              </Link>
            }
          />
        </Card>
      </PublicShell>
    )
  }

  const company = job.company
  const posted = postedLabel(job.publishedAt)
  const applied = !!result
  const remote = job.location?.remote || job.remotePolicy === 'REMOTE'

  const applyButton = (size: 'md' | 'lg' = 'md', className = '') =>
    applied ? (
      <Btn size={size} variant="secondary" className={className} icon={<Check className="h-4 w-4" />} disabled>
        Application sent
      </Btn>
    ) : (
      <Btn size={size} variant="primary" className={className} onClick={() => setApplyOpen(true)}>
        Apply for this role
      </Btn>
    )

  return (
    <PublicShell
      header={
        <>
          <Link
            to="/careers"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 transition-colors duration-base ease-out hover:text-accent-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All roles
          </Link>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-4">
              {company && <CompanyMark name={company.name} logoUrl={company.logoUrl} />}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-600">
                  <span className="font-medium text-ink-900">{company?.name || 'Confidential client'}</span>
                  {company?.industry && (
                    <>
                      <span className="text-ink-300">·</span>
                      <span>{company.industry}</span>
                    </>
                  )}
                </div>
                <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-ink-900">
                  {job.title}
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {remote && <Pill tone="accent">Remote friendly</Pill>}
                  {job.employmentType && <Pill>{humanize(job.employmentType)}</Pill>}
                  {job.requiresResume && <Pill tone="info">CV required</Pill>}
                  {posted && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                      <Clock className="h-3.5 w-3.5" /> {posted}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Btn icon={copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} onClick={copyLink}>
                {copied ? 'Link copied' : 'Copy link'}
              </Btn>
              <span className="hidden lg:inline-flex">{applyButton()}</span>
            </div>
          </div>
        </>
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}

      {result && (
        <Alert tone="success">
          <div className="space-y-1">
            <p className="font-medium">Application sent for {result.jobTitle}.</p>
            <p>
              {result.accountCreated
                ? 'Your tracking account is ready — sign in to follow your progress.'
                : result.canTrack
                ? 'Sign in to follow your progress.'
                : 'A recruiter will be in touch about next steps.'}
            </p>
            {result.canTrack && (
              <Link to="/login" className="inline-block font-medium underline">Sign in to track it</Link>
            )}
          </div>
        </Alert>
      )}

      {/* gap-px over a hairline background keeps the dividers right whether the
          strip sits as two columns or four. */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-ink-200 sm:grid-cols-4">
          <Fact icon={<MapPin className="h-4 w-4" />} label="Location" value={locationLabel(job)} />
          <Fact icon={<Banknote className="h-4 w-4" />} label="Compensation" value={salaryLabel(job)} />
          <Fact
            icon={<Briefcase className="h-4 w-4" />}
            label="Employment"
            value={job.employmentType ? humanize(job.employmentType) : 'Not specified'}
          />
          <Fact
            icon={remote ? <Globe className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
            label="Work setup"
            value={job.remotePolicy ? humanize(job.remotePolicy) : 'Not specified'}
          />
        </div>
      </Card>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3.5">
          <Card>
            <CardHead title="About the role" />
            <div className="px-5 py-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{job.description}</p>
            </div>
          </Card>

          {job.responsibilities?.length ? (
            <Card>
              <CardHead title="What you will do" subtitle="The work this role owns day to day" />
              <div className="px-5 py-4">
                <BulletList items={job.responsibilities} />
              </div>
            </Card>
          ) : null}

          {job.requirements?.length ? (
            <Card>
              <CardHead title="What we are looking for" subtitle="What the hiring team has asked for" />
              <div className="px-5 py-4">
                <BulletList items={job.requirements} />
              </div>
            </Card>
          ) : null}

          {company?.description ? (
            <Card>
              <CardHead title={`About ${company.name}`} />
              <div className="px-5 py-5">
                <p className="text-sm leading-relaxed text-ink-700">{company.description}</p>
                {company.cultureTags?.length ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {company.cultureTags.map(t => <Tag key={t}>{t}</Tag>)}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-3.5 lg:sticky lg:top-20">
          <Card className="overflow-hidden">
            <div className="border-b border-ink-200 px-4 py-4">
              <p className="eyebrow">Compensation</p>
              <p className="mt-1 font-mono text-lg font-semibold tnum text-ink-900">{salaryLabel(job)}</p>
              <p className="mt-0.5 text-xs text-ink-500">{locationLabel(job)}</p>
            </div>
            <div className="px-4 py-4">
              {applyButton('lg', 'w-full')}
              <p className="mt-2 text-center text-2xs text-ink-500">
                {applied ? 'We have your details.' : 'Takes about two minutes'}
              </p>
              {!applied && job.requiresResume && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-ink-600">
                  <FileText className="h-3.5 w-3.5 text-ink-400" /> Have your CV to hand — this role asks for one
                </p>
              )}
            </div>
          </Card>

          {job.requiredSkills?.length || job.niceToHaveSkills?.length ? (
            <Card>
              <CardHead title="Skills" />
              <div className="px-4 py-4">
                {job.requiredSkills?.length ? (
                  <>
                    <p className="eyebrow mb-2">Required</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.requiredSkills.map((s, i) => <Tag key={i}>{s.name}</Tag>)}
                    </div>
                  </>
                ) : null}
                {job.niceToHaveSkills?.length ? (
                  <>
                    <p className="eyebrow mb-2 mt-4">Nice to have</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.niceToHaveSkills.map((s, i) => <Tag key={i}>{s.name}</Tag>)}
                    </div>
                  </>
                ) : null}
              </div>
            </Card>
          ) : null}

          {company && (
            <Card>
              <CardHead title="The employer" />
              <div className="px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <CompanyMark name={company.name} logoUrl={company.logoUrl} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{company.name}</p>
                    {company.industry && <p className="truncate text-xs text-ink-500">{company.industry}</p>}
                  </div>
                </div>
                <dl className="mt-3.5 space-y-2 border-t border-ink-200 pt-3.5 text-xs">
                  {company.size && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">Team size</dt>
                      <dd className="font-medium text-ink-900">{company.size} people</dd>
                    </div>
                  )}
                  {company.location?.city && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">Headquarters</dt>
                      <dd className="truncate font-medium text-ink-900">{company.location.city}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Hiring for</dt>
                    <dd className="truncate font-medium text-ink-900">{job.title}</dd>
                  </div>
                </dl>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Clears the fixed apply bar so it never covers the last card. */}
      <div className="h-16 lg:hidden" />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">{job.title}</p>
            <p className="truncate font-mono text-xs tnum text-ink-500">{salaryLabel(job)}</p>
          </div>
          {applyButton()}
        </div>
      </div>

      <Modal
        open={applyOpen}
        title={`Apply — ${job.title}`}
        description={`Your application goes to the recruiting team for ${company?.name || 'this role'}.`}
        onClose={() => setApplyOpen(false)}
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setApplyOpen(false)}>Cancel</Btn>
            <Btn form="apply-form" type="submit" variant="primary" loading={saving}>
              {saving ? 'Sending…' : 'Submit application'}
            </Btn>
          </>
        }
      >
        <form id="apply-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {prefilling && (
            <div className="sm:col-span-2">
              <Loading label="Fetching your details" />
            </div>
          )}
          {signedIn && profile && (
            <div className="sm:col-span-2">
              <Alert tone="info">
                Filled in from your profile — change anything that is out of date and your profile
                is updated with it.
              </Alert>
            </div>
          )}
          <FormSection title="About you" />
          <Field label="First name">
            <input required className={inputClass} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input required className={inputClass} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field
            label="Email"
            hint={signedIn ? 'Your account email — contact your recruiter to change it' : undefined}
          >
            <input
              required
              type="email"
              disabled={signedIn}
              className={inputClass}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </Field>

          <FormSection title="Your experience" />
          <Field label="Current title">
            <input className={inputClass} value={form.currentTitle} onChange={e => setForm({ ...form, currentTitle: e.target.value })} />
          </Field>
          <Field label="Current employer">
            <input className={inputClass} value={form.currentCompany} onChange={e => setForm({ ...form, currentCompany: e.target.value })} />
          </Field>
          <Field label="Years of experience">
            <input type="number" min="0" className={inputClass} value={form.experienceYears} onChange={e => setForm({ ...form, experienceYears: e.target.value })} />
          </Field>
          <Field label="Salary expectation">
            <input type="number" min="0" className={inputClass} value={form.salaryExpectationMin} onChange={e => setForm({ ...form, salaryExpectationMin: e.target.value })} />
          </Field>
          <Field label="Availability">
            <select className={selectClass} value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })}>
              {['IMMEDIATE', 'ONE_WEEK', 'TWO_WEEKS', 'ONE_MONTH', 'TWO_MONTHS'].map(a => (
                <option key={a} value={a}>{humanize(a)}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Your skills" hint="Comma separated">
              <input className={inputClass} value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} />
            </Field>
          </div>

          <FormSection title="Your application" />
          <div className="sm:col-span-2">
            <ResumeField
              endpoint={signedIn ? '/me/resume' : '/public/resumes'}
              value={resume}
              onChange={setResume}
              required={Boolean(job.requiresResume)}
              label="CV"
              hint={
                job.requiresResume
                  ? 'This role will not accept an application without a CV. PDF or Word, up to 5 MB.'
                  : signedIn && resume && resume.id === profile?.resume?.id
                  ? 'The CV on your profile. Replace it here if you have a newer one.'
                  : 'Optional for this role. PDF or Word, up to 5 MB.'
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="Why you are a fit" hint="Optional, but it helps">
              <textarea rows={4} className={inputClass} value={form.coverNote} onChange={e => setForm({ ...form, coverNote: e.target.value })} />
            </Field>
          </div>
          {!signedIn && (
            <div className="sm:col-span-2">
              <Field
                label="Create a password (optional)"
                hint="Set one and you can sign in to follow this application. Leave blank to apply without an account."
              >
                <input type="password" minLength={6} className={inputClass} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </Field>
            </div>
          )}
        </form>
      </Modal>
    </PublicShell>
  )
}
