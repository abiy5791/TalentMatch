export interface User {
  id: string
  email: string
  role: 'SUPER_ADMIN' | 'MANAGER' | 'RECRUITER' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'CANDIDATE'
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING'
  firstName: string
  lastName: string
  phone?: string
  lastLoginAt?: string
  createdAt?: string
  /** Resolved server-side from the role; present on login and /auth/me. */
  permissions?: string[]
  roleDescription?: string
  /** Which of the three surfaces this account belongs to. */
  home?: 'console' | 'portal' | 'candidate'
  /** Set for client-portal accounts only. */
  companyId?: string | null
  company?: { id: string; name: string; tier: string } | null
}

export interface Company {
  id: string
  name: string
  slug?: string
  industry?: string
  size?: string
  location?: { city?: string; country?: string }
  website?: string
  description?: string
  cultureTags?: string[]
  tier: 'STANDARD' | 'VIP' | 'RETAINER'
  status: string
  accountManager?: User | null
  createdAt: string
}

export interface Skill {
  id?: string
  skillName: string
  category?: string
  proficiencyLevel?: number
  yearsOfExperience?: number
  isPrimary?: boolean
}

export interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  location?: { city?: string; country?: string }
  currentTitle?: string
  currentCompany?: string
  experienceYears?: number
  salaryExpectationMin?: number
  salaryExpectationMax?: number
  currency?: string
  availability?: string
  status: string
  verifiedFlags?: Record<string, boolean>
  skills?: Skill[]
  assignedRecruiter?: User | null
  createdAt: string
}

export interface RequiredSkill {
  name: string
  level: number
}

/** An uploaded CV as every surface sees it — metadata only, never the bytes. */
export interface ResumeRef {
  id: string
  fileName: string
  sizeBytes: number
  uploadedAt?: string
  /** Only on a fresh anonymous upload: when it is swept if never submitted. */
  expiresAt?: string | null
}

export interface Job {
  id: string
  title: string
  /** Readable identifier the public board uses in its URLs. */
  slug?: string
  description: string
  status: string
  visibility: string
  salaryMin?: number
  salaryMax?: number
  currency?: string
  location?: { city?: string; country?: string; remote?: boolean }
  remotePolicy?: string
  employmentType?: string
  requirements?: string[]
  responsibilities?: string[]
  requiredSkills?: RequiredSkill[]
  niceToHaveSkills?: RequiredSkill[]
  /** When set, an application without a CV is refused. */
  requiresResume?: boolean
  company?: Company
  approvedAt?: string
  publishedAt?: string
  createdAt: string
}

export interface Match {
  id: string
  overallScore: number
  skillMatchScore: number
  experienceMatchScore: number
  locationMatchScore: number
  salaryMatchScore: number
  cultureMatchScore: number
  candidate: Candidate
  job: Job
}

export interface PipelineEntry {
  id: string
  entityType: string
  entityId: string
  entityName: string
  stage: string
  previousStage?: string
  nextStages: string[]
  notes?: string
  createdAt: string
  changedBy?: User | null
}

export interface Placement {
  id: string
  status: string
  startDate?: string
  salaryOffered?: number
  placementFee?: number
  feePercentage?: number
  satisfactionScore?: number
  candidate?: Candidate
  job?: Job
  company?: Company
  createdAt: string
}

export interface DashboardMetrics {
  totalCandidates: number
  totalJobs: number
  totalCompanies: number
  totalPlacements: number
  activeJobs: number
}

export interface PlacementMetrics {
  placed: number
  sentToClient: number
  successRate: number
  totalPlacements: number
  totalFees: number
  avgSatisfaction: number
  /** Currency the fee totals are denominated in, derived from the placed roles. */
  currency?: string
}

export interface GapRow {
  skill: string
  job_count: number
  candidate_count: number
  gap: number
  severity: 'CRITICAL' | 'HIGH' | 'NORMAL'
}

/* ---- Client portal ------------------------------------------------------- */

/** What an employer is allowed to see about a candidate sent to them. */
export interface SubmittedCandidate {
  id: string
  firstName: string
  lastName: string
  currentTitle?: string
  currentCompany?: string
  experienceYears?: number
  location?: { city?: string; country?: string }
  availability?: string
  noticePeriodDays?: number
  salaryExpectationMin?: number
  salaryExpectationMax?: number
  currency?: string
  skills?: Skill[]
  verified?: boolean
}

export type SubmissionStatus =
  | 'SENT' | 'VIEWED' | 'SHORTLISTED' | 'INTERVIEW_REQUESTED' | 'DECLINED'

export interface Submission {
  id: string
  status: SubmissionStatus
  message?: string
  clientNote?: string
  submittedAt: string
  viewedAt?: string | null
  respondedAt?: string | null
  candidate: SubmittedCandidate
  job?: { id: string; title: string } | null
}

export interface PortalJob {
  id: string
  title: string
  status: string
  description: string
  location?: { city?: string; country?: string; remote?: boolean }
  remotePolicy?: string
  employmentType?: string
  salaryMin?: number
  salaryMax?: number
  currency?: string
  requiredSkills?: RequiredSkill[]
  submitted: number
  awaitingReview: number
}

export interface PortalPlacement {
  id: string
  status: string
  startDate?: string
  satisfactionScore?: number
  clientFeedback?: { comment?: string }
  candidate?: { id: string; firstName: string; lastName: string } | null
  job?: { id: string; title: string } | null
}

export interface PortalOverview {
  openRoles: number
  totalRoles: number
  awaitingReview: number
  shortlisted: number
  interviewsRequested: number
  declined: number
  candidatesSubmitted: number
  placements: number
  activePlacements: number
}

export interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'CLIENT_ADMIN' | 'CLIENT_USER'
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING'
  lastLoginAt?: string | null
  createdAt: string
  permissions: string[]
}

/* ---- Public job board ---------------------------------------------------- */

/** The slice of a company a logged-out visitor sees on a posting. */
export interface PublicCompany {
  name: string
  industry?: string
  size?: string
  description?: string
  cultureTags?: string[]
  logoUrl?: string
  location?: { city?: string; country?: string }
}

/**
 * A posting as served by /public/jobs. Deliberately narrower than `Job`: no
 * status, no visibility, no internal owner — the API never sends them.
 */
export interface PublicJob {
  id: string
  slug?: string
  title: string
  description: string
  requirements?: string[]
  responsibilities?: string[]
  requiredSkills?: RequiredSkill[]
  niceToHaveSkills?: RequiredSkill[]
  location?: { city?: string; country?: string; remote?: boolean }
  remotePolicy?: string
  employmentType?: string
  salaryMin?: number
  salaryMax?: number
  currency?: string
  requiresResume?: boolean
  publishedAt?: string
  company?: PublicCompany | null
}

/** Filter values derived from what is actually live on the board. */
export interface PublicFilters {
  total: number
  skills: string[]
  locations: string[]
  employmentTypes: string[]
}

/* ---- Candidate self-service ---------------------------------------------- */

export type ApplicationStatus =
  | 'SUBMITTED' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'INTERVIEWING'
  | 'OFFERED' | 'HIRED' | 'NOT_PROGRESSING' | 'WITHDRAWN'

/** One plain-language entry in the history an applicant is shown. */
export interface TimelineEntry {
  status: string
  label: string
  note?: string
  at: string
}

/** An application as the applicant sees it — /me/applications. */
export interface MyApplication {
  id: string
  status: ApplicationStatus
  statusLabel: string
  statusHint?: string
  /** Position in the journey, or -1 for withdrawn / not progressing. */
  step: number
  totalSteps: number
  closed: boolean
  appliedAt: string
  updatedAt: string
  coverNote?: string
  /** The CV sent with this application, frozen at submission. */
  resume?: ResumeRef | null
  timeline: TimelineEntry[]
  job?: {
    id: string
    slug?: string
    title: string
    location?: { city?: string; country?: string; remote?: boolean }
    employmentType?: string
    salaryMin?: number
    salaryMax?: number
    currency?: string
  } | null
  company?: { name: string } | null
}

export interface MySummary {
  total: number
  active: number
  interviewing: number
  offers: number
  closed: number
}

/** The applicant's own profile — /me/profile. */
export interface MyProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  location?: { city?: string; country?: string }
  currentTitle?: string
  currentCompany?: string
  experienceYears?: number
  salaryExpectationMin?: number
  salaryExpectationMax?: number
  currency?: string
  availability?: string
  noticePeriodDays?: number
  resumeUrl?: string
  /** The CV currently on file, reused when applying to a new role. */
  resume?: ResumeRef | null
  skills?: Skill[]
  verified?: boolean
}

/* ---- Applications (recruiter console) ------------------------------------ */

/** An application as the recruiting team sees it — /applications. */
export interface ApplicationRow {
  id: string
  status: ApplicationStatus
  source: string
  coverNote?: string
  resume?: ResumeRef | null
  appliedAt: string
  updatedAt: string
  candidate?: {
    id: string
    firstName: string
    lastName: string
    email: string
    currentTitle?: string
    experienceYears?: number
    status: string
  } | null
  job?: { id: string; title: string; status: string } | null
  company?: { id: string; name: string } | null
}
