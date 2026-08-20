import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Loader2, Search } from 'lucide-react'

/* ============================================================
   Quorum design system — shared primitives
   Neutral spine + a single orange accent used sparingly.
   ============================================================ */

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

export const toneBg: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-info-50 text-info-700',
  accent: 'bg-accent-50 text-accent-800',
}

export const toneFill: Record<Tone, string> = {
  neutral: 'bg-ink-400',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  accent: 'bg-accent-500',
}

/** Every lifecycle stage across candidates, companies, jobs and placements. */
const STAGE_TONE: Record<string, Tone> = {
  // Candidates
  UNASSIGNED: 'neutral',
  SCREENING: 'info',
  MATCHED: 'success',
  SENT_TO_COMPANY: 'info',
  INTERVIEWING: 'warning',
  OFFERED: 'accent',
  PLACED: 'success',
  REJECTED: 'danger',
  ARCHIVED: 'neutral',
  // Companies
  LEAD: 'neutral',
  ONBOARDED: 'info',
  ACTIVE: 'success',
  FULFILLED: 'accent',
  INACTIVE: 'danger',
  // Jobs
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  LIVE: 'success',
  PAUSED: 'warning',
  CLOSED: 'danger',
  FILLED: 'info',
  // Placements
  COMPLETED: 'info',
  TERMINATED: 'danger',
  // Users
  SUPER_ADMIN: 'accent',
  MANAGER: 'info',
  RECRUITER: 'success',
  CLIENT_ADMIN: 'warning',
  CLIENT_USER: 'neutral',
  SUSPENDED: 'danger',
  PENDING: 'warning',
  // Gap severity
  CRITICAL: 'danger',
  HIGH: 'warning',
  NORMAL: 'neutral',
}

export const stageTone = (stage?: string): Tone => STAGE_TONE[stage || ''] || 'neutral'

/** `SENT_TO_COMPANY` → `SENT TO COMPANY` */
export const humanize = (value?: string) => (value || '').replace(/_/g, ' ')

/* ---- Pill ---------------------------------------------------- */
export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-xs px-2 text-2xs
        font-semibold uppercase tracking-[0.04em] ${toneBg[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/** Small neutral chip for skills, tags and other free-form labels. */
export function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-xs bg-ink-100 px-2 py-0.5 text-xs text-ink-600 ${className}`}>
      {children}
    </span>
  )
}

/**
 * A pill that is also a control — used wherever a row's lifecycle stage can be
 * changed in place. Falls back to a plain read-only pill when not permitted.
 */
export function StatusSelect({
  value,
  options,
  onChange,
  disabled = false,
  tone,
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
  disabled?: boolean
  tone?: Tone
}) {
  const resolved = tone || stageTone(value)

  if (disabled) return <Pill tone={resolved}>{humanize(value)}</Pill>

  return (
    <span className={`relative inline-flex h-[22px] items-center rounded-xs ${toneBg[resolved]}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-[22px] cursor-pointer appearance-none bg-transparent pl-2 pr-5 text-2xs font-semibold
          uppercase tracking-[0.04em] text-current outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"
      >
        {options.map(o => (
          <option key={o} value={o} className="bg-white text-ink-900">
            {humanize(o)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 opacity-60" />
    </span>
  )
}

/* ---- Surfaces ------------------------------------------------ */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function CardHead({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start justify-between gap-3 border-b border-ink-200 px-4 py-3.5 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-md font-semibold tracking-snug text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ---- Buttons ------------------------------------------------- */
type BtnVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'

/**
 * Written out in full rather than composed as `btn-${variant}`: Tailwind scans
 * source for literal class names, so an interpolated name would be purged from
 * the stylesheet and the button would render unstyled.
 */
const VARIANT_CLASS: Record<BtnVariant, string> = {
  primary: 'btn-primary',
  dark: 'btn-dark',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const SIZE_CLASS: Record<BtnSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
  icon?: ReactNode
}

export function Btn({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: BtnProps) {
  return (
    <button
      className={`btn ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

/* ---- Avatar -------------------------------------------------- */
const AVATAR_TONES: Tone[] = ['info', 'success', 'accent', 'warning', 'neutral']

/** Deterministic tint so the same person keeps the same colour between renders. */
export function avatarTone(seed: string): Tone {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

export function Avatar({
  name,
  size = 32,
  rounded = 'full',
  className = '',
}: {
  name: string
  size?: number
  rounded?: 'full' | 'md'
  className?: string
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '—'

  return (
    <span
      style={{ width: size, height: size, fontSize: size < 30 ? 10 : 12 }}
      className={`inline-flex shrink-0 items-center justify-center font-semibold
        ${rounded === 'full' ? 'rounded-full' : 'rounded-sm'} ${toneBg[avatarTone(name)]} ${className}`}
    >
      {initials}
    </span>
  )
}

/* ---- Feedback ------------------------------------------------ */
export function Alert({ tone = 'danger', children }: { tone?: Tone; children: ReactNode }) {
  const accentBar: Record<Tone, string> = {
    neutral: 'border-l-ink-400',
    success: 'border-l-success-500',
    warning: 'border-l-warning-500',
    danger: 'border-l-danger-500',
    info: 'border-l-info-500',
    accent: 'border-l-accent-500',
  }
  return (
    <div
      className={`animate-slide-up rounded-sm border border-l-[3px] border-ink-200 px-3.5 py-2.5 text-sm
        ${toneBg[tone]} ${accentBar[tone]}`}
    >
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
  className = '',
}: {
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`px-5 py-11 text-center ${className}`}>
      <p className="text-base font-medium text-ink-900">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3 text-ink-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

/* ---- Data display -------------------------------------------- */
export function Bar({ value, tone = 'neutral', className = '' }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-200 ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-slow ease-out ${toneFill[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function StatCard({
  label,
  value,
  unit,
  note,
  to,
}: {
  label: string
  value: ReactNode
  unit?: string
  note?: ReactNode
  to?: string
}) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-mono text-2xl font-medium tracking-tight tnum text-ink-900">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-500">{unit}</span>}
      </p>
      {note && <p className="mt-1.5 text-xs text-ink-500">{note}</p>}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="card block px-4 py-3.5 transition-colors duration-base ease-out hover:border-ink-300 hover:bg-ink-50"
      >
        {body}
      </Link>
    )
  }
  return <div className="card px-4 py-3.5">{body}</div>
}

/* ---- Toolbar ------------------------------------------------- */
export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative min-w-[200px] flex-1 ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  )
}

/** Segmented control — one visible group of mutually exclusive options. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-md bg-ink-100 p-[3px]">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex h-7 shrink-0 items-center gap-1.5 rounded-sm px-3 text-xs font-medium
              transition-colors duration-base ease-out
              ${active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---- Formatting helpers -------------------------------------- */
export const pct = (n?: number | string) => `${Math.round(Number(n) || 0)}%`

/**
 * Money is formatted from the currency on the record, never from a hardcoded
 * symbol — the desk bills in birr, but a client or a role can carry its own.
 * Intl throws on an unknown code, so bad data degrades to the code itself
 * rather than taking the page down with it.
 */
const FALLBACK_CURRENCY = 'ETB'

const formatMoney = (value: number, currency: string, compact: boolean) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    }).format(value)
  } catch {
    return `${currency} ${Math.round(value).toLocaleString('en-US')}`
  }
}

export const moneyK = (n?: number, currency?: string) =>
  n ? formatMoney(n, currency || FALLBACK_CURRENCY, true) : '—'

export const money = (n?: number, currency?: string) =>
  n ? formatMoney(n, currency || FALLBACK_CURRENCY, false) : '—'

export const scoreTone = (score: number): Tone => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'info'
  if (score >= 40) return 'warning'
  return 'danger'
}

export const scoreTextColor = (score: number) => {
  if (score >= 80) return 'text-success-500'
  if (score >= 60) return 'text-ink-900'
  if (score >= 40) return 'text-warning-700'
  return 'text-danger-500'
}

/* ---- Row actions --------------------------------------------- */
/**
 * Compact square button for per-row edit/delete affordances. Kept as an icon
 * with a title + aria-label rather than a dropdown: one click, no menu state.
 */
export function IconBtn({
  icon,
  label,
  onClick,
  tone = 'neutral',
  disabled = false,
  loading = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  tone?: 'neutral' | 'danger'
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-ink-200
        bg-white transition-colors duration-base ease-out
        focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ink-900/12
        disabled:cursor-not-allowed disabled:opacity-40
        ${tone === 'danger'
          ? 'text-ink-400 hover:border-danger-500 hover:bg-danger-50 hover:text-danger-500'
          : 'text-ink-500 hover:border-ink-300 hover:bg-ink-100 hover:text-ink-900'}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
    </button>
  )
}
