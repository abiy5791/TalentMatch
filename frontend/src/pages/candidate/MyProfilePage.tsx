import { FormEvent, useEffect, useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { MyProfile, ResumeRef } from '../../types'
import { Field, inputClass, selectClass } from '../../components/Modal'
import { ResumeField } from '../../components/ResumeField'
import { Alert, Btn, Card, CardHead, Loading, Pill, humanize } from '../../components/ui'

export function MyProfilePage() {
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', city: '', country: '',
    currentTitle: '', currentCompany: '', experienceYears: '',
    salaryExpectationMin: '', salaryExpectationMax: '', noticePeriodDays: '',
    availability: 'IMMEDIATE', skills: '',
  })

  useEffect(() => {
    api
      .get<MyProfile>('/me/profile')
      .then(p => {
        setProfile(p)
        setForm({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          phone: p.phone || '',
          city: p.location?.city || '',
          country: p.location?.country || '',
          currentTitle: p.currentTitle || '',
          currentCompany: p.currentCompany || '',
          experienceYears: p.experienceYears?.toString() || '',
          salaryExpectationMin: p.salaryExpectationMin?.toString() || '',
          salaryExpectationMax: p.salaryExpectationMax?.toString() || '',
          noticePeriodDays: p.noticePeriodDays?.toString() || '',
          availability: p.availability || 'IMMEDIATE',
          skills: (p.skills || []).map(s => s.skillName).join(', '),
        })
      })
      .catch(e => setError(e instanceof ApiError ? e.message : 'Could not load your profile'))
      .finally(() => setLoading(false))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updated = await api.put<MyProfile>('/me/profile', {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        location: { city: form.city, country: form.country },
        currentTitle: form.currentTitle || undefined,
        currentCompany: form.currentCompany || undefined,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        salaryExpectationMin: form.salaryExpectationMin ? Number(form.salaryExpectationMin) : undefined,
        salaryExpectationMax: form.salaryExpectationMax ? Number(form.salaryExpectationMax) : undefined,
        noticePeriodDays: form.noticePeriodDays ? Number(form.noticePeriodDays) : undefined,
        availability: form.availability,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      })
      setProfile(updated)
      setNotice('Profile updated — recruiters will see the latest version.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your profile')
    }
    setSaving(false)
  }

  if (loading) return <Loading label="Loading your profile" />

  return (
    <div className="space-y-3.5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card className="overflow-hidden">
        <CardHead
          title="Your details"
          subtitle="What recruiters see when they consider you for a role"
          action={
            profile?.verified ? (
              <Pill tone="success">
                <BadgeCheck className="mr-1 h-3 w-3" /> Verified
              </Pill>
            ) : undefined
          }
        />
        <form onSubmit={submit} className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <Field label="First name">
            <input required className={inputClass} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input required className={inputClass} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Email" hint="Contact your recruiter to change this">
            <input disabled className={inputClass} value={profile?.email || ''} />
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
          <Field label="Current title">
            <input className={inputClass} value={form.currentTitle} onChange={e => setForm({ ...form, currentTitle: e.target.value })} />
          </Field>
          <Field label="Current employer">
            <input className={inputClass} value={form.currentCompany} onChange={e => setForm({ ...form, currentCompany: e.target.value })} />
          </Field>
          <Field label="Years of experience">
            <input type="number" min="0" className={inputClass} value={form.experienceYears} onChange={e => setForm({ ...form, experienceYears: e.target.value })} />
          </Field>
          <Field label="Notice period (days)">
            <input type="number" min="0" className={inputClass} value={form.noticePeriodDays} onChange={e => setForm({ ...form, noticePeriodDays: e.target.value })} />
          </Field>
          <Field label="Salary expectation from">
            <input type="number" min="0" className={inputClass} value={form.salaryExpectationMin} onChange={e => setForm({ ...form, salaryExpectationMin: e.target.value })} />
          </Field>
          <Field label="Salary expectation to">
            <input type="number" min="0" className={inputClass} value={form.salaryExpectationMax} onChange={e => setForm({ ...form, salaryExpectationMax: e.target.value })} />
          </Field>
          <Field label="Availability">
            <select className={selectClass} value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })}>
              {['IMMEDIATE', 'ONE_WEEK', 'TWO_WEEKS', 'ONE_MONTH', 'TWO_MONTHS'].map(a => (
                <option key={a} value={a}>{humanize(a)}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            {/*
              Uploads on selection, outside the form's own save — so the CV is
              stored the moment it is chosen and the Save button stays about the
              text fields.
            */}
            <ResumeField
              endpoint="/me/resume"
              value={profile?.resume || null}
              onChange={(resume: ResumeRef | null) => {
                setProfile(p => (p ? { ...p, resume } : p))
                if (resume) setNotice('CV saved — it will be attached to roles you apply for.')
              }}
              downloadable
              label="Your CV"
              hint="Recruiters read this alongside your profile. PDF or Word, up to 5 MB."
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="Skills" hint="Comma separated — these drive the roles you get matched to">
              <input className={inputClass} value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Btn type="submit" variant="primary" loading={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Btn>
          </div>
        </form>
      </Card>
    </div>
  )
}
