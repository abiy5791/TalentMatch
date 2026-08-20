import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JobPosting } from '../../entities/job-posting.entity';
import { Candidate } from '../../entities/candidate.entity';
import { CandidateSkill } from '../../entities/candidate-skill.entity';
import { Application } from '../../entities/application.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { ResumeStorageService } from '../resumes/resume-storage.service';
import { ApplyDto } from './dto/public.dto';

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(JobPosting) private jobRepo: Repository<JobPosting>,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(CandidateSkill) private skillRepo: Repository<CandidateSkill>,
    @InjectRepository(Application) private applicationRepo: Repository<Application>,
    @InjectRepository(PipelineStage) private pipelineRepo: Repository<PipelineStage>,
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private resumes: ResumeStorageService,
  ) {}

  /**
   * A posting is on the public board only when it is both LIVE and marked
   * PUBLIC. Drafts, roles awaiting approval, and anything PRIVATE or
   * CONFIDENTIAL are not listed and cannot be fetched by id either.
   */
  private readonly publiclyVisible = { status: 'LIVE' as const, visibility: 'PUBLIC' as const };

  /** Only the fields a stranger on the internet should see. */
  private present(job: JobPosting) {
    return {
      id: job.id,
      slug: job.slug,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      requiredSkills: job.requiredSkills,
      niceToHaveSkills: job.niceToHaveSkills,
      location: job.location,
      remotePolicy: job.remotePolicy,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      requiresResume: job.requiresResume,
      publishedAt: job.publishedAt,
      company: job.company
        ? {
            name: job.company.name,
            industry: job.company.industry,
            size: job.company.size,
            description: job.company.description,
            cultureTags: job.company.cultureTags,
            logoUrl: job.company.logoUrl,
            location: job.company.location,
          }
        : null,
    };
  }

  async listJobs(query: any = {}) {
    const base: any = { ...this.publiclyVisible };
    if (query.employmentType) base.employmentType = query.employmentType;
    if (query.remotePolicy) base.remotePolicy = query.remotePolicy;

    // A free-text search covers the two things a jobseeker types: the role and
    // the employer. Two WHERE branches rather than one, because they sit on
    // different tables.
    const search = String(query.search || '').trim();
    const where = search
      ? [
          { ...base, title: ILike(`%${search}%`) },
          { ...base, company: { name: ILike(`%${search}%`) } },
        ]
      : base;

    const jobs = await this.jobRepo.find({
      where,
      relations: ['company'],
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
    });

    // Skill and city live inside JSON columns, so they are matched here rather
    // than in SQL — before the page is cut, or filtering would only ever search
    // the first page and quietly report no matches.
    let results = jobs.map(j => this.present(j));

    if (query.skill) {
      const needle = String(query.skill).toLowerCase();
      results = results.filter(j =>
        [...(j.requiredSkills || []), ...(j.niceToHaveSkills || [])].some(s =>
          (s?.name || '').toLowerCase().includes(needle),
        ),
      );
    }
    if (query.location) {
      const needle = String(query.location).toLowerCase();
      results = results.filter(j =>
        (j.location?.city || '').toLowerCase().includes(needle) ||
        (j.location?.country || '').toLowerCase().includes(needle),
      );
    }

    const offset = Math.max(0, Number(query.offset) || 0);
    const limit = Math.min(Math.max(1, Number(query.limit) || 50), 100);
    return results.slice(offset, offset + limit);
  }

  /**
   * A returning applicant may know more about themselves than the record does.
   * Only blank fields are filled and only unseen skills are added: nothing a
   * recruiter has already established about this person is overwritten.
   */
  private async topUpProfile(candidate: Candidate, dto: ApplyDto) {
    const patch: Partial<Candidate> = {};
    const fill = <K extends keyof Candidate>(key: K, value: Candidate[K] | undefined) => {
      if (value !== undefined && value !== null && value !== '' &&
          (candidate[key] === null || candidate[key] === undefined || candidate[key] === '')) {
        patch[key] = value;
      }
    };

    fill('phone', dto.phone);
    fill('currentTitle', dto.currentTitle);
    fill('currentCompany', dto.currentCompany);
    fill('experienceYears', dto.experienceYears);
    fill('salaryExpectationMin', dto.salaryExpectationMin);
    fill('salaryExpectationMax', dto.salaryExpectationMax);
    fill('resumeUrl', dto.resumeUrl);
    if (dto.location?.city && !candidate.location?.city) patch.location = dto.location;

    if (Object.keys(patch).length) await this.candidateRepo.update(candidate.id, patch);

    if (dto.skills?.length) {
      const held = await this.skillRepo.find({ where: { candidate: { id: candidate.id } } });
      const known = new Set(held.map(s => s.skillName.toLowerCase()));
      const fresh = dto.skills.filter(name => name && !known.has(name.toLowerCase()));
      if (fresh.length) {
        await this.skillRepo.save(
          fresh.map(name =>
            this.skillRepo.create({
              skillName: name,
              proficiencyLevel: 3,
              candidate: { id: candidate.id } as any,
            }),
          ),
        );
      }
    }
  }

  /** Accepts a slug or an id, so the board can use readable URLs. */
  async getJob(slugOrId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    const job = await this.jobRepo.findOne({
      where: { ...this.publiclyVisible, ...(isUuid ? { id: slugOrId } : { slug: slugOrId }) },
      relations: ['company'],
    });
    if (!job) throw new NotFoundException('This role is no longer available');
    return this.present(job);
  }

  /** The filter values worth offering, derived from what is actually live. */
  async getFilters() {
    const jobs = await this.jobRepo.find({ where: this.publiclyVisible, relations: ['company'] });
    const skills = new Set<string>();
    const locations = new Set<string>();
    const types = new Set<string>();
    for (const job of jobs) {
      (job.requiredSkills || []).forEach(s => s?.name && skills.add(s.name));
      if (job.location?.city) locations.add(job.location.city);
      if (job.employmentType) types.add(job.employmentType);
    }
    return {
      total: jobs.length,
      skills: [...skills].sort(),
      locations: [...locations].sort(),
      employmentTypes: [...types].sort(),
    };
  }

  /**
   * Apply to a live role.
   *
   * Applying is what creates a candidate record — and, if the applicant sets a
   * password, the login they use to track it. The role is forced to CANDIDATE so
   * this open endpoint can never mint anything else.
   */
  async apply(dto: ApplyDto) {
    const job = await this.jobRepo.findOne({
      where: { ...this.publiclyVisible, id: dto.jobId },
      relations: ['company', 'company.accountManager'],
    });
    if (!job) throw new NotFoundException('This role is no longer accepting applications');

    // Checked before anything is written: an application that cannot be
    // completed should not leave a half-made candidate record behind.
    if (job.requiresResume && !dto.resumeId) {
      throw new BadRequestException('This role asks for a CV. Attach one and submit again.');
    }

    const email = dto.email.trim().toLowerCase();
    let candidate = await this.candidateRepo.findOne({ where: { email } });
    let createdCandidate = false;

    if (!candidate) {
      candidate = await this.candidateRepo.save(
        this.candidateRepo.create({
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          phone: dto.phone,
          location: dto.location,
          currentTitle: dto.currentTitle,
          currentCompany: dto.currentCompany,
          experienceYears: dto.experienceYears,
          salaryExpectationMin: dto.salaryExpectationMin,
          salaryExpectationMax: dto.salaryExpectationMax,
          availability: dto.availability || 'IMMEDIATE',
          resumeUrl: dto.resumeUrl,
          source: 'Public board',
          status: 'UNASSIGNED',
        }),
      );
      createdCandidate = true;

      if (dto.skills?.length) {
        await this.skillRepo.save(
          dto.skills.map(name =>
            this.skillRepo.create({ skillName: name, proficiencyLevel: 3, candidate: { id: candidate.id } as any }),
          ),
        );
      }
      await this.pipelineRepo.save(
        this.pipelineRepo.create({
          entityType: 'CANDIDATE',
          entityId: candidate.id,
          stage: 'UNASSIGNED',
          notes: `Applied for ${job.title} via the public board`,
        }),
      );
    } else {
      await this.topUpProfile(candidate, dto);
    }

    const existing = await this.applicationRepo.findOne({
      where: { candidate: { id: candidate.id }, job: { id: job.id } },
    });
    if (existing && existing.status !== 'WITHDRAWN') {
      throw new ConflictException('You have already applied for this role');
    }

    // Only now, with a real candidate to own it, does the upload stop being a
    // stranger's file waiting to be swept.
    const resume = dto.resumeId ? await this.resumes.claim(dto.resumeId, candidate.id) : null;
    if (resume) await this.candidateRepo.update(candidate.id, { resumeFile: { id: resume.id } as any });

    const now = new Date().toISOString();
    const application = await this.applicationRepo.save({
      ...(existing ? { id: existing.id } : {}),
      candidate: { id: candidate.id } as any,
      job: { id: job.id } as any,
      company: { id: job.company?.id } as any,
      coverNote: dto.coverNote,
      resumeFile: resume ? ({ id: resume.id } as any) : null,
      status: 'SUBMITTED' as const,
      source: 'PUBLIC_BOARD',
      withdrawnAt: null,
      // Re-applying after withdrawing keeps the earlier history rather than
      // rewriting it — both sides should still see what happened the first time.
      timeline: [
        ...(existing?.timeline || []),
        {
          status: 'SUBMITTED',
          note: existing ? 'Applied again for this role' : 'Application received',
          at: now,
        },
      ],
    });

    // Optional login, so the applicant can follow their own progress.
    let accountCreated = false;
    if (dto.password) {
      const existingUser = await this.userRepo.findOne({ where: { email } });
      if (!existingUser) {
        const user = await this.userRepo.save(
          this.userRepo.create({
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            // Forced — this endpoint is unauthenticated.
            role: 'CANDIDATE',
            status: 'ACTIVE',
            passwordHash: await bcrypt.hash(dto.password, 10),
          }),
        );
        await this.candidateRepo.update(candidate.id, { user: { id: user.id } as any });
        accountCreated = true;
      }
    }

    await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient: job.company?.accountManager ? ({ id: job.company.accountManager.id } as any) : null,
        recipientEmail: email,
        type: 'APPLICATION_RECEIVED',
        category: 'PUBLIC_BOARD',
        subject: `New application: ${dto.firstName} ${dto.lastName} for ${job.title}`,
        content: dto.coverNote?.slice(0, 240),
        metadata: { applicationId: application.id, candidateId: candidate.id, jobId: job.id },
        status: 'DELIVERED',
        sentAt: new Date(),
      }),
    );

    return {
      applicationId: application.id,
      status: application.status,
      resumeAttached: Boolean(resume),
      jobTitle: job.title,
      company: job.company?.name,
      createdCandidate,
      accountCreated,
      // Tells the board whether to offer "track your application" or "sign in".
      canTrack: accountCreated || Boolean(await this.userRepo.findOne({ where: { email } })),
    };
  }
}
