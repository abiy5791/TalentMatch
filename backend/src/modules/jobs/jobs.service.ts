import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { JobPosting } from '../../entities/job-posting.entity';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';
import { hasPermission, PERMISSIONS } from '../auth/permissions';

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

@Injectable()
export class JobsService {
  constructor(@InjectRepository(JobPosting) private repo: Repository<JobPosting>) {}

  async findAll(query: any = {}) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.companyId) where.company = { id: query.companyId };
    if (query.visibility) where.visibility = query.visibility;
    if (query.search) where.title = ILike(`%${query.search}%`);
    // The public job board only ever shows published, publicly visible roles.
    if (query.public === 'true') {
      where.status = In(['LIVE']);
      where.visibility = 'PUBLIC';
    }
    return this.repo.find({
      where,
      relations: ['company', 'approvedBy', 'createdBy'],
      order: { createdAt: 'DESC' },
      take: Number(query.limit) || 50,
      skip: Number(query.offset) || 0,
    });
  }

  async findById(id: string) {
    const job = await this.repo.findOne({
      where: { id },
      relations: ['company', 'approvedBy', 'createdBy'],
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async create(dto: CreateJobDto, createdById?: string, role?: string) {
    const { companyId, ...rest } = dto;
    const job = this.repo.create({
      ...(rest as Partial<JobPosting>),
      status: this.requestedStatus(dto.status, role),
      slug: dto.slug || `${slugify(dto.title)}-${Date.now().toString(36)}`,
      company: { id: companyId } as any,
      createdBy: createdById ? ({ id: createdById } as any) : null,
    });
    return this.repo.save(job);
  }

  async update(id: string, dto: UpdateJobDto, role?: string) {
    const { companyId, ...rest } = dto as UpdateJobDto & { companyId?: string };
    await this.findById(id);
    await this.repo.update(id, {
      ...(rest as Partial<JobPosting>),
      ...(dto.status ? { status: this.requestedStatus(dto.status, role) } : {}),
      ...(companyId ? { company: { id: companyId } as any } : {}),
    });
    return this.findById(id);
  }

  /** Recruiter route to the approval queue — the gate itself needs jobs:approve. */
  async submitForApproval(id: string) {
    const job = await this.findById(id);
    if (job.status !== 'DRAFT' && job.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Job in status ${job.status} cannot be submitted for approval`);
    }
    await this.repo.update(id, { status: 'PENDING_APPROVAL' });
    return this.findById(id);
  }

  /**
   * Without jobs:approve a caller cannot set a post-approval status directly —
   * otherwise the approval gate could be bypassed through create/update.
   */
  private requestedStatus(status: string | undefined, role?: string): JobPosting['status'] {
    const requested = (status || 'DRAFT') as JobPosting['status'];
    if (!role || hasPermission(role, PERMISSIONS.JOBS_APPROVE)) return requested;
    if (['APPROVED', 'LIVE', 'FILLED'].includes(requested)) {
      throw new ForbiddenException(
        `Your role cannot set a job to ${requested}. Submit it for approval instead.`,
      );
    }
    return requested;
  }

  /** Approval gate: DRAFT/PENDING_APPROVAL -> APPROVED. */
  async approve(id: string, approvedById?: string) {
    const job = await this.findById(id);
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(job.status)) {
      throw new BadRequestException(`Job in status ${job.status} cannot be approved`);
    }
    await this.repo.update(id, {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: approvedById ? ({ id: approvedById } as any) : null,
    });
    return this.findById(id);
  }

  /** Publishing gate: only an approved job may go LIVE. */
  async publish(id: string) {
    const job = await this.findById(id);
    if (!['APPROVED', 'PAUSED'].includes(job.status)) {
      throw new BadRequestException(`Job must be APPROVED before publishing (currently ${job.status})`);
    }
    await this.repo.update(id, { status: 'LIVE', publishedAt: job.publishedAt || new Date() });
    return this.findById(id);
  }

  async updateStatus(id: string, status: string) {
    await this.findById(id);
    await this.repo.update(id, { status: status as JobPosting['status'] });
    return this.findById(id);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.repo.update(id, { status: 'CLOSED' });
    return { closed: true, id };
  }
}
