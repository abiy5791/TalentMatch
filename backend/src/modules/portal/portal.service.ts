import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { CandidateDispatch } from '../../entities/candidate-dispatch.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Company } from '../../entities/company.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { Placement } from '../../entities/placement.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { isClientRole, permissionsFor } from '../auth/permissions';
import {
  RespondDto, RequestRoleDto, PortalFeedbackDto, InviteColleagueDto,
} from './dto/portal.dto';
import { ApplicationsService } from '../applications/applications.service';

/** Statuses a client may set, and what each means internally. */
const RESPONSE_STATUS = {
  SHORTLIST: 'SHORTLISTED',
  INTERVIEW: 'INTERVIEW_REQUESTED',
  DECLINE: 'DECLINED',
} as const;

@Injectable()
export class PortalService {
  constructor(
    @InjectRepository(CandidateDispatch) private dispatchRepo: Repository<CandidateDispatch>,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    @InjectRepository(JobPosting) private jobRepo: Repository<JobPosting>,
    @InjectRepository(Placement) private placementRepo: Repository<Placement>,
    @InjectRepository(PipelineStage) private pipelineRepo: Repository<PipelineStage>,
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private applications: ApplicationsService,
  ) {}

  /**
   * What an employer is allowed to know about a candidate they were sent.
   *
   * Direct contact details are withheld — the agency arranges introductions, and
   * a portal that hands over an email address invites the client to go around
   * it. Internal fields (source, owning recruiter, parsed CV, raw verification
   * detail) never leave the console.
   */
  private presentCandidate(candidate: Candidate) {
    if (!candidate) return null;
    const flags = candidate.verifiedFlags || {};
    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      currentTitle: candidate.currentTitle,
      currentCompany: candidate.currentCompany,
      experienceYears: candidate.experienceYears,
      location: candidate.location,
      availability: candidate.availability,
      noticePeriodDays: candidate.noticePeriodDays,
      // Needed to judge whether an offer is realistic.
      salaryExpectationMin: candidate.salaryExpectationMin,
      salaryExpectationMax: candidate.salaryExpectationMax,
      currency: candidate.currency,
      skills: (candidate.skills || []).map(s => ({
        skillName: s.skillName,
        category: s.category,
        proficiencyLevel: s.proficiencyLevel,
        yearsOfExperience: s.yearsOfExperience,
      })),
      // A single badge rather than the internal check-by-check record.
      verified: Boolean(flags.identity || flags.references || flags.backgroundCheck),
    };
  }

  private presentJob(job: JobPosting) {
    if (!job) return null;
    return {
      id: job.id,
      title: job.title,
      status: job.status,
      description: job.description,
      location: job.location,
      remotePolicy: job.remotePolicy,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      requirements: job.requirements,
      requiredSkills: job.requiredSkills,
      createdAt: job.createdAt,
      publishedAt: job.publishedAt,
    };
  }

  async getCompany(companyId: string) {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      location: company.location,
      tier: company.tier,
      logoUrl: company.logoUrl,
    };
  }

  async getOverview(companyId: string) {
    const [jobs, dispatches, placements] = await Promise.all([
      this.jobRepo.find({ where: { company: { id: companyId } } }),
      this.dispatchRepo.find({ where: { company: { id: companyId } } }),
      this.placementRepo.find({ where: { company: { id: companyId } } }),
    ]);

    const byStatus = (status: string) => dispatches.filter(d => d.status === status).length;
    return {
      openRoles: jobs.filter(j => ['LIVE', 'APPROVED'].includes(j.status)).length,
      totalRoles: jobs.length,
      awaitingReview: byStatus('SENT') + byStatus('VIEWED'),
      shortlisted: byStatus('SHORTLISTED'),
      interviewsRequested: byStatus('INTERVIEW_REQUESTED'),
      declined: byStatus('DECLINED'),
      candidatesSubmitted: dispatches.length,
      placements: placements.length,
      activePlacements: placements.filter(p => p.status === 'ACTIVE').length,
    };
  }

  /** Only this employer's own postings. */
  async getJobs(companyId: string, query: any = {}) {
    const where: any = { company: { id: companyId } };
    if (query.status) where.status = query.status;
    const jobs = await this.jobRepo.find({ where, order: { createdAt: 'DESC' } });

    const dispatches = await this.dispatchRepo.find({
      where: { company: { id: companyId } },
      relations: ['job'],
    });

    return jobs.map(job => ({
      ...this.presentJob(job),
      submitted: dispatches.filter(d => d.job?.id === job.id).length,
      awaitingReview: dispatches.filter(
        d => d.job?.id === job.id && ['SENT', 'VIEWED'].includes(d.status),
      ).length,
    }));
  }

  /** Candidates formally submitted to this employer — nothing else is visible. */
  async getSubmittedCandidates(companyId: string, query: any = {}) {
    const where: any = { company: { id: companyId } };
    if (query.status) where.status = query.status;
    if (query.jobId) where.job = { id: query.jobId };

    const dispatches = await this.dispatchRepo.find({
      where,
      relations: ['candidate', 'candidate.skills', 'job'],
      order: { createdAt: 'DESC' },
      take: Number(query.limit) || 100,
    });

    return dispatches.map(d => ({
      id: d.id,
      status: d.status,
      message: d.message,
      clientNote: d.clientNote,
      submittedAt: d.createdAt,
      viewedAt: d.viewedAt,
      respondedAt: d.respondedAt,
      candidate: this.presentCandidate(d.candidate),
      job: d.job ? { id: d.job.id, title: d.job.title } : null,
    }));
  }

  private async findDispatch(companyId: string, dispatchId: string) {
    const dispatch = await this.dispatchRepo.findOne({
      where: { id: dispatchId, company: { id: companyId } },
      relations: ['candidate', 'job', 'company'],
    });
    // Scoped lookup: another employer's dispatch is simply not found here.
    if (!dispatch) throw new NotFoundException('Submission not found');
    return dispatch;
  }

  async getSubmission(companyId: string, dispatchId: string) {
    const dispatch = await this.findDispatch(companyId, dispatchId);
    if (!dispatch.viewedAt) {
      await this.dispatchRepo.update(dispatch.id, {
        viewedAt: new Date(),
        status: dispatch.status === 'SENT' ? 'VIEWED' : dispatch.status,
      });
    }
    const fresh = await this.dispatchRepo.findOne({
      where: { id: dispatch.id },
      relations: ['candidate', 'candidate.skills', 'job'],
    });
    return {
      id: fresh.id,
      status: fresh.status,
      message: fresh.message,
      clientNote: fresh.clientNote,
      submittedAt: fresh.createdAt,
      viewedAt: fresh.viewedAt,
      respondedAt: fresh.respondedAt,
      candidate: this.presentCandidate(fresh.candidate),
      job: this.presentJob(fresh.job),
    };
  }

  /**
   * The client's decision on a submitted candidate. Requesting an interview
   * advances the candidate's internal pipeline; a decline is recorded and the
   * recruiter decides what happens next.
   */
  async respond(companyId: string, dispatchId: string, dto: RespondDto, userId: string) {
    const dispatch = await this.findDispatch(companyId, dispatchId);
    if (dispatch.status === 'DECLINED') {
      throw new BadRequestException('This candidate has already been declined');
    }

    const status = RESPONSE_STATUS[dto.decision];
    await this.dispatchRepo.update(dispatch.id, {
      status,
      clientNote: dto.note || dispatch.clientNote,
      respondedAt: new Date(),
      respondedBy: { id: userId } as any,
      viewedAt: dispatch.viewedAt || new Date(),
    });

    const candidateName = `${dispatch.candidate?.firstName} ${dispatch.candidate?.lastName}`;
    const label = {
      SHORTLIST: 'shortlisted',
      INTERVIEW: 'requested an interview with',
      DECLINE: 'declined',
    }[dto.decision];

    if (dto.decision === 'INTERVIEW' && dispatch.candidate?.status === 'SENT_TO_COMPANY') {
      await this.candidateRepo.update(dispatch.candidate.id, { status: 'INTERVIEWING' });
      await this.pipelineRepo.save(
        this.pipelineRepo.create({
          entityType: 'CANDIDATE',
          entityId: dispatch.candidate.id,
          stage: 'INTERVIEWING',
          previousStage: 'SENT_TO_COMPANY',
          notes: `${dispatch.company?.name} requested an interview`,
          changedBy: { id: userId } as any,
        }),
      );
    }

    // Keep the applicant's own view of this role in step with the decision.
    if (dispatch.candidate?.id && dispatch.job?.id) {
      const applicantStatus =
        dto.decision === 'INTERVIEW' ? 'INTERVIEWING'
        : dto.decision === 'DECLINE' ? 'NOT_PROGRESSING'
        : 'SHORTLISTED';
      await this.applications.syncFromEvent(
        dispatch.candidate.id, dispatch.job.id, applicantStatus as any,
        dto.decision === 'INTERVIEW'
          ? 'The employer would like to meet you'
          : dto.decision === 'DECLINE'
          ? 'The employer decided not to progress'
          : 'The employer shortlisted your profile',
      );
    }

    // Tell the account manager, so the response shows up in the console.
    const company = await this.companyRepo.findOne({ where: { id: companyId }, relations: ['accountManager'] });
    await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient: company?.accountManager ? ({ id: company.accountManager.id } as any) : null,
        type: 'CLIENT_RESPONSE',
        category: 'PORTAL',
        subject: `${company?.name} ${label} ${candidateName}`,
        content: dto.note || `${candidateName} — ${dispatch.job?.title}`,
        metadata: {
          dispatchId: dispatch.id,
          candidateId: dispatch.candidate?.id,
          jobId: dispatch.job?.id,
          companyId,
          decision: dto.decision,
        },
        status: 'DELIVERED',
        sentAt: new Date(),
      }),
    );

    return this.getSubmission(companyId, dispatchId);
  }

  /** Placements at this employer, with fees withheld — that is the agency's side. */
  async getPlacements(companyId: string) {
    const placements = await this.placementRepo.find({
      where: { company: { id: companyId } },
      relations: ['candidate', 'job'],
      order: { createdAt: 'DESC' },
    });
    return placements.map(p => ({
      id: p.id,
      status: p.status,
      startDate: p.startDate,
      satisfactionScore: p.satisfactionScore,
      clientFeedback: p.clientFeedback,
      candidate: p.candidate
        ? { id: p.candidate.id, firstName: p.candidate.firstName, lastName: p.candidate.lastName }
        : null,
      job: p.job ? { id: p.job.id, title: p.job.title } : null,
    }));
  }

  async leaveFeedback(companyId: string, placementId: string, dto: PortalFeedbackDto) {
    const placement = await this.placementRepo.findOne({
      where: { id: placementId, company: { id: companyId } },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    await this.placementRepo.update(placementId, {
      satisfactionScore: dto.satisfactionScore ?? placement.satisfactionScore,
      clientFeedback: {
        ...(placement.clientFeedback || {}),
        ...(dto.comment ? { comment: dto.comment } : {}),
        submittedAt: new Date().toISOString(),
      },
    });
    return (await this.getPlacements(companyId)).find(p => p.id === placementId);
  }

  /* ---- Team management (account owner only) ------------------------------ */

  /** Portal accounts at this employer. Internal staff are never in this list. */
  async getTeam(companyId: string) {
    const members = await this.userRepo.find({
      where: { companyId },
      order: { createdAt: 'ASC' },
    });
    return members
      .filter(m => isClientRole(m.role))
      .map(m => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
        status: m.status,
        lastLoginAt: m.lastLoginAt,
        createdAt: m.createdAt,
        permissions: permissionsFor(m.role),
      }));
  }

  /**
   * Invite a colleague. The company comes from the caller's scope and the role
   * is restricted to portal roles, so an account owner can neither reach another
   * employer nor mint themselves an internal staff login.
   */
  async inviteTeamMember(companyId: string, dto: InviteColleagueDto) {
    if (!isClientRole(dto.role)) {
      throw new BadRequestException('You can only invite Client Admin or Client User accounts');
    }
    if (await this.userRepo.findOne({ where: { email: dto.email } })) {
      throw new ConflictException('That email address is already in use');
    }

    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as any,
        // Never taken from the request body.
        companyId,
        status: 'ACTIVE',
        passwordHash: await bcrypt.hash(dto.password, 10),
      }),
    );

    const company = await this.companyRepo.findOne({
      where: { id: companyId },
      relations: ['accountManager'],
    });
    await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient: company?.accountManager ? ({ id: company.accountManager.id } as any) : null,
        type: 'PORTAL_TEAM_CHANGE',
        category: 'PORTAL',
        subject: `${company?.name} added a portal user`,
        content: `${dto.firstName} ${dto.lastName} (${dto.role.replace('_', ' ').toLowerCase()})`,
        metadata: { companyId, userId: user.id, role: dto.role },
        status: 'DELIVERED',
        sentAt: new Date(),
      }),
    );

    return (await this.getTeam(companyId)).find(m => m.id === user.id);
  }

  /** Suspend a leaver or reinstate them. Scoped, and never yourself. */
  async setTeamMemberStatus(companyId: string, userId: string, status: string, actorId: string) {
    if (userId === actorId) {
      throw new BadRequestException('You cannot change your own access');
    }
    const member = await this.userRepo.findOne({ where: { id: userId, companyId } });
    if (!member || !isClientRole(member.role)) {
      throw new NotFoundException('Team member not found');
    }
    await this.userRepo.update(userId, { status: status as any });
    return (await this.getTeam(companyId)).find(m => m.id === userId);
  }

  /** Promote a colleague to account owner, or step them back down. */
  async setTeamMemberRole(companyId: string, userId: string, role: string, actorId: string) {
    if (!isClientRole(role)) {
      throw new BadRequestException('Portal accounts can only hold Client Admin or Client User');
    }
    if (userId === actorId) {
      throw new BadRequestException('You cannot change your own role');
    }
    const member = await this.userRepo.findOne({ where: { id: userId, companyId } });
    if (!member || !isClientRole(member.role)) {
      throw new NotFoundException('Team member not found');
    }

    // Leaving an employer with nobody who can administer it strands the account.
    if (member.role === 'CLIENT_ADMIN' && role !== 'CLIENT_ADMIN') {
      const owners = (await this.getTeam(companyId)).filter(
        m => m.role === 'CLIENT_ADMIN' && m.status === 'ACTIVE',
      );
      if (owners.length <= 1) {
        throw new BadRequestException('Your company needs at least one active account owner');
      }
    }

    await this.userRepo.update(userId, { role: role as any });
    return (await this.getTeam(companyId)).find(m => m.id === userId);
  }

  /**
   * A client asking for a new role. It enters the internal approval queue as a
   * draft — a client cannot publish a live posting on their own.
   */
  async requestRole(companyId: string, dto: RequestRoleDto, userId: string) {
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        company: { id: companyId } as any,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        remotePolicy: dto.remotePolicy,
        employmentType: dto.employmentType,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        requiredSkills: dto.requiredSkills || [],
        status: 'PENDING_APPROVAL',
        visibility: 'PRIVATE',
        slug: `${dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
      }),
    );

    const company = await this.companyRepo.findOne({ where: { id: companyId }, relations: ['accountManager'] });
    await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient: company?.accountManager ? ({ id: company.accountManager.id } as any) : null,
        type: 'ROLE_REQUEST',
        category: 'PORTAL',
        subject: `${company?.name} requested a new role: ${dto.title}`,
        content: dto.description?.slice(0, 240),
        metadata: { jobId: job.id, companyId, requestedBy: userId },
        status: 'DELIVERED',
        sentAt: new Date(),
      }),
    );
    return this.presentJob(job);
  }
}
