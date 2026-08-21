-- ============================================
-- Recruitment Platform Database Schema
-- PostgreSQL 16
-- ============================================
--
-- Reference DDL. In development the API owns the schema: TypeORM synchronises
-- these tables from the entities in backend/src/entities on boot, using a
-- snake_case naming strategy so the generated columns match this file.
--
-- Use this script when provisioning the database up front (staging/production):
--   psql -U postgres -d recruitment -f database/schema.sql
-- then start the API with DB_SYNCHRONIZE=false.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE TABLES
-- ============================================

-- Users (Identity Service)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- Three surfaces: staff use the console, CLIENT_* the employer portal,
    -- CANDIDATE the applicant's own area.
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'MANAGER', 'RECRUITER', 'CLIENT_ADMIN', 'CLIENT_USER', 'CANDIDATE')),
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING')),
    -- Set for client-portal accounts only; scopes everything they can see.
    company_id UUID,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    industry VARCHAR(100),
    size VARCHAR(50) CHECK (size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
    location JSONB DEFAULT '{}',
    website VARCHAR(255),
    description TEXT,
    culture_tags TEXT[],
    logo_url TEXT,
    banner_url TEXT,
    tier VARCHAR(50) DEFAULT 'STANDARD' CHECK (tier IN ('STANDARD', 'VIP', 'RETAINER')),
    status VARCHAR(50) DEFAULT 'LEAD' CHECK (status IN ('LEAD', 'ONBOARDED', 'ACTIVE', 'FULFILLED', 'INACTIVE')),
    account_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    onboarding_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    location JSONB DEFAULT '{}',
    current_title VARCHAR(255),
    current_company VARCHAR(255),
    experience_years INTEGER,
    salary_expectation_min INTEGER,
    salary_expectation_max INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',
    notice_period_days INTEGER,
    availability VARCHAR(50) DEFAULT 'IMMEDIATE',
    status VARCHAR(50) DEFAULT 'UNASSIGNED' CHECK (status IN ('UNASSIGNED', 'SCREENING', 'MATCHED', 'SENT_TO_COMPANY', 'INTERVIEWING', 'OFFERED', 'PLACED', 'ARCHIVED')),
    verified_flags JSONB DEFAULT '{}',
    resume_url TEXT,
    -- The CV they last uploaded here. FK added below, once resume_files exists.
    resume_file_id UUID,
    resume_parsed_data JSONB DEFAULT '{}',
    source VARCHAR(100),
    assigned_recruiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate Skills
CREATE TABLE candidate_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
    years_of_experience DECIMAL(4,1),
    is_primary BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Postings
CREATE TABLE job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT NOT NULL,
    requirements TEXT[],
    responsibilities TEXT[],
    -- JSONB array of {name, level}, e.g. [{"name":"React","level":4}].
    -- A single jsonb value (not jsonb[]) so analytics can use jsonb_array_elements().
    required_skills JSONB DEFAULT '[]',
    nice_to_have_skills JSONB DEFAULT '[]',
    location JSONB DEFAULT '{}',
    remote_policy VARCHAR(50),
    salary_min INTEGER,
    salary_max INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',
    employment_type VARCHAR(50),
    visibility VARCHAR(50) DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'CONFIDENTIAL')),
    -- When true, an application that arrives without a CV is refused.
    requires_resume BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'LIVE', 'PAUSED', 'CLOSED', 'FILLED')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match Scores
CREATE TABLE match_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
    overall_score DECIMAL(5,2) CHECK (overall_score BETWEEN 0 AND 100),
    skill_match_score DECIMAL(5,2),
    location_match_score DECIMAL(5,2),
    salary_match_score DECIMAL(5,2),
    experience_match_score DECIMAL(5,2),
    culture_match_score DECIMAL(5,2),
    factor_breakdown JSONB DEFAULT '{}',
    algorithm_version VARCHAR(20),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, job_id)
);

-- Pipeline Stages
CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('COMPANY', 'CANDIDATE', 'PLACEMENT')),
    entity_id UUID NOT NULL,
    stage VARCHAR(100) NOT NULL,
    previous_stage VARCHAR(100),
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Placements
CREATE TABLE placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
    job_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'TERMINATED')),
    start_date DATE,
    end_date DATE,
    salary_offered INTEGER,
    placement_fee DECIMAL(10,2),
    fee_percentage DECIMAL(5,2),
    client_feedback JSONB DEFAULT '{}',
    candidate_feedback JSONB DEFAULT '{}',
    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate submissions to a client (client portal visibility + delivery tracking)
CREATE TABLE candidate_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'SENT'
        CHECK (status IN ('SENT', 'VIEWED', 'SHORTLISTED', 'INTERVIEW_REQUESTED', 'DECLINED')),
    message TEXT,
    client_note TEXT,
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    dispatched_by UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, job_id)
);

-- Uploaded CVs. The bytes live on disk under UPLOAD_DIR, named after `id`; this
-- table is the only index into them, and GET /resumes/:id the only way out.
CREATE TABLE resume_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Null until an anonymous upload is attached to the application that used it.
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    -- The uploader's filename, sanitised. Display only; never used as a path.
    original_name VARCHAR(255) NOT NULL,
    -- Resolved from the file's own signature, not from the client's header.
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL,
    -- The file itself, under the `db` storage driver. Null under `fs`, where the
    -- bytes are on disk as <id>.bin. A serverless deployment has no durable disk,
    -- so there the column is where a CV actually lives.
    data BYTEA,
    checksum VARCHAR(64) NOT NULL,
    claimed BOOLEAN DEFAULT false,
    -- Unclaimed uploads are swept, so a stranger cannot fill the disk and leave.
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- candidates.resume_file_id closes a cycle with the table above, so the
-- constraint is added once both exist.
ALTER TABLE candidates
    ADD CONSTRAINT fk_candidates_resume_file
    FOREIGN KEY (resume_file_id) REFERENCES resume_files(id) ON DELETE SET NULL;

-- Applications (someone applying to a role themselves, via the public board)
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
    -- Denormalised from the job so the console can filter by client cheaply.
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    -- Deliberately coarser than the internal pipeline: what the applicant sees.
    status VARCHAR(50) DEFAULT 'SUBMITTED'
        CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING',
                          'OFFERED', 'HIRED', 'NOT_PROGRESSING', 'WITHDRAWN')),
    cover_note TEXT,
    -- Frozen at submission: the document actually sent, not the newest one.
    resume_file_id UUID REFERENCES resume_files(id) ON DELETE SET NULL,
    source VARCHAR(50) DEFAULT 'PUBLIC_BOARD',
    -- Plain-language history the applicant reads: [{status, note, at}].
    timeline JSONB DEFAULT '[]',
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, job_id)
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255),
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    subject VARCHAR(255),
    content TEXT,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'PENDING',
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Logs (Audit)
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_location ON candidates USING GIN(location);
CREATE INDEX idx_candidates_assigned_recruiter ON candidates(assigned_recruiter_id);
CREATE INDEX idx_candidate_skills_candidate ON candidate_skills(candidate_id);
CREATE INDEX idx_candidate_skills_name ON candidate_skills(skill_name, proficiency_level);
CREATE INDEX idx_jobs_status_visibility ON job_postings(status, visibility);
CREATE INDEX idx_jobs_company ON job_postings(company_id, status);
CREATE INDEX idx_match_scores_job ON match_scores(job_id, overall_score DESC);
CREATE INDEX idx_match_scores_candidate ON match_scores(candidate_id, overall_score DESC);
CREATE INDEX idx_pipeline_entity ON pipeline_stages(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_placements_company ON placements(company_id, status);
CREATE INDEX idx_companies_tier ON companies(tier, status);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_dispatches_company ON candidate_dispatches(company_id, status);
CREATE INDEX idx_dispatches_job ON candidate_dispatches(job_id, status);
CREATE INDEX idx_resume_files_sweep ON resume_files(claimed, expires_at);
CREATE INDEX idx_resume_files_candidate ON resume_files(candidate_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id, status);
CREATE INDEX idx_applications_job ON applications(job_id, status);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, status);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, created_at DESC);

-- ============================================
-- SEED DATA
-- ============================================
--
-- Demo data is NOT duplicated here. It is loaded by the API's SeedService
-- (backend/src/seed/seed.service.ts), which runs once on first boot against an
-- empty users table and additionally computes the initial match scores.
--
-- Keeping a single seeder avoids the two copies drifting apart, and the service
-- can hash the demo passwords properly (bcrypt) rather than embedding a literal.
--
-- Demo logins created by the seeder:
--   admin@talentmatch.io     / admin123      (SUPER_ADMIN)
--   manager@talentmatch.io   / manager123    (MANAGER)
--   recruiter@talentmatch.io / recruiter123  (RECRUITER)
--   client@techcorp.io       / client123     (CLIENT_ADMIN)
--   alice@example.com        / candidate123  (CANDIDATE)
