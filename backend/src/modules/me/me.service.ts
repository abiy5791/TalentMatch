import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from '../../entities/application.entity';
import { Candidate } from '../../entities/candidate.entity';
import { CandidateSkill } from '../../entities/candidate-skill.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { Notification } from '../../entities/notification.entity';
import { ResumeFile } from '../../entities/resume-file.entity';
import { ResumeStorageService } from '../resumes/resume-storage.service';
import { ApplyAsCandidateDto, UpdateMyProfileDto } from './dto/me.dto';

/** What each stage means to the person waiting on it. */
const STATUS_COPY: Record<ApplicationStatus, { label: string; hint: string }> = {
  SUBMITTED: { label: 'Application received', hint: 'A recruiter will review your profile shortly.' },
  UNDER_REVIEW: { label: 'Under review', hint: 'A recruiter is assessing your fit for this role.' },
  SHORTLISTED: { label: 'Shared with the employer', hint: 'Your profile has been put forward to the hiring team.' },
  INTERVIEWING: { label: 'Interviewing', hint: 'The employer would like to meet you — your recruiter will be in touch.' },
  OFFERED: { label: 'Offer stage', hint: 'An offer is being prepared or discussed.' },
  HIRED: { label: 'Hired', hint: 'Congratulations — this role is yours.' },
  NOT_PROGRESSING: { label: 'Not progressing', hint: 'This application will not be taken further.' },
  WITHDRAWN: { label: 'Withdrawn', hint: 'You withdrew this application.' },
};

/** The order an applicant is shown, so a progress bar can be drawn. */
export const CANDIDATE_JOURNEY: ApplicationStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'HIRED',
];

@Injectable()
export class MeService {
  constructor(
    @InjectRepository(Application) private applicationRepo: Repository<Application>,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(CandidateSkill) private skillRepo: Repository<CandidateSkill>,
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @InjectRepository(JobPosting) private jobRepo: Repository<JobPosting>,
    private resumes: ResumeStorageService,
  ) {}

  /** The shape a CV takes everywhere an applicant sees one. */
  private presentResume(file?: ResumeFile | null) {
    if (!file) return null;
    return {
      id: file.id,
      fileName: file.originalName,
      sizeBytes: file.sizeBytes,
      uploadedAt: file.createdAt,
    };
  }

  async getProfile(candidateId: string) {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      relations: ['skills', 'resumeFile'],
    });
    if (!candidate) throw new NotFoundException('Profile not found');

    const flags = candidate.verifiedFlags || {};
    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      location: candidate.location,
      currentTitle: candidate.currentTitle,
      currentCompany: candidate.currentCompany,
      experienceYears: candidate.experienceYears,
      salaryExpectationMin: candidate.salaryExpectationMin,
      salaryExpectationMax: candidate.salaryExpectationMax,
      currency: candidate.currency,
      availability: candidate.availability,
      noticePeriodDays: candidate.noticePeriodDays,
      resumeUrl: candidate.resumeUrl,
      resume: this.presentResume(candidate.resumeFile),
      skills: (candidate.skills || []).map(s => ({
        skillName: s.skillName,
        category: s.category,
        proficiencyLevel: s.proficiencyLevel,
        yearsOfExperience: s.yearsOfExperience,
      })),
      verified: Boolean(flags.identity || flags.references || flags.backgroundCheck),
      // Deliberately absent: internal pipeline status, assigned recruiter,
      // source, parsed CV data and every match score.
    };
  }

  /** An applicant may correct their own details, but not their status or skills' verification. */
  async updateProfile(candidateId: string, dto: UpdateMyProfileDto) {
    const { skills, ...rest } = dto;
    await this.candidateRepo.update(candidateId, rest as Partial<Candidate>);

    if (skills) {
      await this.skillRepo.delete({ candidate: { id: candidateId } as any });
      if (skills.length) {
        await this.skillRepo.save(
          skills.map(name =>
            this.skillRepo.create({
              skillName: name,
              proficiencyLevel: 3,
              candidate: { id: candidateId } as any,
            }),
          ),
        );
      }
    }
    return this.getProfile(candidateId);
  }

  private present(application: Application) {
    const status = application.status;
    const stepIndex = CANDIDATE_JOURNEY.indexOf(status);
    return {
      id: application.id,
      status,
      statusLabel: STATUS_COPY[status]?.label || status,
      statusHint: STATUS_COPY[status]?.hint,
      // -1 for withdrawn / not progressing, which sit outside the journey.
      step: stepIndex,
      totalSteps: CANDIDATE_JOURNEY.length,
      closed: ['NOT_PROGRESSING', 'WITHDRAWN', 'HIRED'].includes(status),
      appliedAt: application.createdAt,
      updatedAt: application.updatedAt,
      coverNote: application.coverNote,
      resume: this.presentResume(application.resumeFile),
      timeline: (application.timeline || []).map(entry => ({
        ...entry,
        label: STATUS_COPY[entry.status as ApplicationStatus]?.label || entry.status,
      })),
      job: application.job
        ? {
            id: application.job.id,
            slug: application.job.slug,
            title: application.job.title,
            location: application.job.location,
            employmentType: application.job.employmentType,
            salaryMin: application.job.salaryMin,
            salaryMax: application.job.salaryMax,
            currency: application.job.currency,
          }
        : null,
      // The employer is named because the applicant applied to them knowingly.
      company: application.company ? { name: application.company.name } : null,
    };
  }

  async getApplications(candidateId: string) {
    const applications = await this.applicationRepo.find({
      where: { candidate: { id: candidateId } },
      relations: ['job', 'company', 'resumeFile'],
      order: { createdAt: 'DESC' },
    });
    return applications.map(a => this.present(a));
  }

  async getApplication(candidateId: string, applicationId: string) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, candidate: { id: candidateId } },
      relations: ['job', 'company', 'resumeFile'],
    });
    // Scoped lookup — somebody else's application is simply not found.
    if (!application) throw new NotFoundException('Application not found');
    return this.present(application);
  }

  async withdraw(candidateId: string, applicationId: string, reason?: string) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, candidate: { id: candidateId } },
      relations: ['job', 'company', 'company.accountManager', 'candidate'],
    });
    if (!application) throw new NotFoundException('Application not found');
    if (['WITHDRAWN', 'HIRED', 'NOT_PROGRESSING'].includes(application.status)) {
      throw new BadRequestException('This application is already closed');
    }

    const at = new Date().toISOString();
    await this.applicationRepo.update(applicationId, {
      status: 'WITHDRAWN',
      withdrawnAt: new Date(),
      timeline: [
        ...(application.timeline || []),
        { status: 'WITHDRAWN', note: reason || 'Withdrawn by the candidate', at },
      ],
    });

    await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient: application.company?.accountManager
          ? ({ id: application.company.accountManager.id } as any)
          : null,
        type: 'APPLICATION_WITHDRAWN',
        category: 'CANDIDATE',
        subject: `${application.candidate?.firstName} ${application.candidate?.lastName} withdrew from ${application.job?.title}`,
        content: reason,
        metadata: { applicationId, candidateId, jobId: application.job?.id },
        status: 'DELIVERED',
        sentAt: new Date(),
      }),
    );

    return this.getApplication(candidateId, applicationId);
  }

  /**
   * Upload a CV against the profile. Append-only: the new file becomes the
   * current one and older files stay where they are, still reachable from the
   * applications that were sent with them.
   */
  async replaceResume(candidateId: string, file: Express.Multer.File) {
    const stored = await this.resumes.store(file, { candidateId });
    await this.candidateRepo.update(candidateId, { resumeFile: { id: stored.id } as any });
    return this.presentResume(stored);
  }

  /**
   * Apply to a role as a signed-in applicant.
   *
   * The identity is the token's, never the request's — there is no name or
   * email field here to disagree with the account. Details already on the
   * profile are simply reused, which is what having an account is for.
   */
  async apply(candidateId: string, dto: ApplyAsCandidateDto) {
    const job = await this.jobRepo.findOne({
      // Same gate the public board applies: LIVE and PUBLIC, nothing else.
      where: { id: dto.jobId, status: 'LIVE', visibility: 'PUBLIC' },
      relations: ['company', 'company.accountManager'],
    });
    if (!job) throw new NotFoundException('This role is no longer accepting applications');

    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      relations: ['resumeFile'],
    });
    if (!candidate) throw new NotFoundException('Profile not found');

    // A CV named in the request wins; otherwise the one already on file does.
    const resume = dto.resumeId
      ? await this.resumes.claim(dto.resumeId, candidateId)
      : candidate.resumeFile;
    if (job.requiresResume && !resume) {
      throw new BadRequestException('This role asks for a CV. Add one to your profile and try again.');
    }

    const existing = await this.applicationRepo.findOne({
      where: { candidate: { id: candidateId }, job: { id: job.id } },
    });
    if (existing && existing.status !== 'WITHDRAWN') {
      throw new ConflictException('You have already applied for this role');
    }

    if (dto.resumeId && resume) {
      await this.candidateRepo.update(candidateId, { resumeFile: { id: resume.id } as any });
    }

    const at = new Date().toISOString();
    const application = await this.applicationRepo.save({
      ...(existing ? { id: existing.id } : {}),
      candidate: { id: candidateId } as any,
      job: { id: job.id } as any,
      company: { id: job.company?.id } as any,
      coverNote: dto.coverNote,
      resumeFile: resume ? ({ id: resume.id } as any) : null,
      status: 'SUBMITTED' as const,
      source: 'CANDIDATE_PORTAL',
      withdrawnAt: null,
      timeline: [
        ...(existing?.timeline || []),
        {
          status: 'SUBMITTED',
          note: existing ? 'Applied again for this role' : 'Application received',
          at,
        },
      ],
    });

    await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient: job.company?.accountManager ? ({ id: job.company.accountManager.id } as any) : null,
        recipientEmail: candidate.email,
        type: 'APPLICATION_RECEIVED',
        category: 'CANDIDATE',
        subject: `New application: ${candidate.firstName} ${candidate.lastName} for ${job.title}`,
        content: dto.coverNote?.slice(0, 240),
        metadata: { applicationId: application.id, candidateId, jobId: job.id },
        status: 'DELIVERED',
        sentAt: new Date(),
      }),
    );

    return this.getApplication(candidateId, application.id);
  }

  /** A short summary for the applicant's home screen. */
  async getSummary(candidateId: string) {
    const applications = await this.applicationRepo.find({
      where: { candidate: { id: candidateId } },
    });
    const count = (statuses: ApplicationStatus[]) =>
      applications.filter(a => statuses.includes(a.status)).length;
    return {
      total: applications.length,
      active: count(['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED']),
      interviewing: count(['INTERVIEWING']),
      offers: count(['OFFERED', 'HIRED']),
      closed: count(['NOT_PROGRESSING', 'WITHDRAWN']),
    };
  }
}
