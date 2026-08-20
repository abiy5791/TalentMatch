import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from '../../entities/application.entity';
import { Notification } from '../../entities/notification.entity';

/** Statuses a recruiter sets by hand. The rest are driven by real events. */
export const MANUAL_STATUSES: ApplicationStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED', 'HIRED', 'NOT_PROGRESSING',
];

/** A closed application is not moved again by an event. */
const CLOSED: ApplicationStatus[] = ['WITHDRAWN', 'HIRED', 'NOT_PROGRESSING'];

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private repo: Repository<Application>,
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
  ) {}

  async findAll(query: any = {}) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.jobId) where.job = { id: query.jobId };
    if (query.candidateId) where.candidate = { id: query.candidateId };
    if (query.companyId) where.company = { id: query.companyId };

    const applications = await this.repo.find({
      where,
      relations: ['candidate', 'job', 'company', 'resumeFile'],
      order: { createdAt: 'DESC' },
      take: Number(query.limit) || 100,
    });

    return applications.map(a => ({
      id: a.id,
      status: a.status,
      source: a.source,
      coverNote: a.coverNote,
      appliedAt: a.createdAt,
      updatedAt: a.updatedAt,
      candidate: a.candidate
        ? {
            id: a.candidate.id,
            firstName: a.candidate.firstName,
            lastName: a.candidate.lastName,
            email: a.candidate.email,
            currentTitle: a.candidate.currentTitle,
            experienceYears: a.candidate.experienceYears,
            status: a.candidate.status,
          }
        : null,
      // Metadata only. The bytes come from GET /resumes/:id, which checks the
      // caller again rather than trusting that they got the id from here.
      resume: a.resumeFile
        ? {
            id: a.resumeFile.id,
            fileName: a.resumeFile.originalName,
            sizeBytes: a.resumeFile.sizeBytes,
            uploadedAt: a.resumeFile.createdAt,
          }
        : null,
      job: a.job ? { id: a.job.id, title: a.job.title, status: a.job.status } : null,
      company: a.company ? { id: a.company.id, name: a.company.name } : null,
    }));
  }

  /** Recruiter moving an application, with a note the applicant will read. */
  async updateStatus(id: string, status: ApplicationStatus, note?: string) {
    if (!MANUAL_STATUSES.includes(status)) {
      throw new BadRequestException(`${status} cannot be set by hand`);
    }
    const application = await this.repo.findOne({ where: { id }, relations: ['candidate', 'job'] });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status === 'WITHDRAWN') {
      throw new BadRequestException('The candidate withdrew this application');
    }
    return this.write(application, status, note);
  }

  /**
   * Keeps the applicant's view honest without anyone remembering to update it:
   * putting them in front of the client, the client asking to meet, and the
   * placement itself each move the application on their behalf.
   */
  async syncFromEvent(
    candidateId: string,
    jobId: string,
    status: ApplicationStatus,
    note?: string,
  ) {
    const application = await this.repo.findOne({
      where: { candidate: { id: candidateId }, job: { id: jobId } },
      relations: ['candidate', 'job'],
    });
    // Sourced candidates have no application; there is simply nothing to sync.
    if (!application || CLOSED.includes(application.status)) return null;
    if (application.status === status) return application;
    return this.write(application, status, note);
  }

  private async write(application: Application, status: ApplicationStatus, note?: string) {
    const at = new Date().toISOString();
    await this.repo.update(application.id, {
      status,
      timeline: [...(application.timeline || []), { status, note, at }],
    });

    if (application.candidate?.user) {
      await this.notificationRepo.save(
        this.notificationRepo.create({
          recipient: { id: (application.candidate.user as any).id } as any,
          recipientEmail: application.candidate.email,
          type: 'APPLICATION_UPDATE',
          category: 'CANDIDATE',
          subject: `Update on your application for ${application.job?.title}`,
          content: note,
          metadata: { applicationId: application.id, status },
          status: 'DELIVERED',
          sentAt: new Date(),
        }),
      );
    }

    return this.repo.findOne({ where: { id: application.id }, relations: ['candidate', 'job'] });
  }
}
