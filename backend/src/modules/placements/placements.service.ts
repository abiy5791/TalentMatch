import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Placement } from '../../entities/placement.entity';
import { Candidate } from '../../entities/candidate.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { CreatePlacementDto, UpdatePlacementDto, FeedbackDto } from './dto/placement.dto';
import { hasPermission, PERMISSIONS } from '../auth/permissions';
import { ApplicationsService } from '../applications/applications.service';

@Injectable()
export class PlacementsService {
  constructor(
    @InjectRepository(Placement) private repo: Repository<Placement>,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(JobPosting) private jobRepo: Repository<JobPosting>,
    @InjectRepository(PipelineStage) private pipelineRepo: Repository<PipelineStage>,
    private applications: ApplicationsService,
  ) {}

  private readonly relations = ['candidate', 'job', 'company'];

  /**
   * Fee and salary are commercial figures. Recruiters need to see that a
   * placement happened, not what it earned, so those fields are removed unless
   * the caller holds analytics:financials.
   */
  private redact<T extends Placement>(placement: T, role?: string): T {
    if (!role || hasPermission(role, PERMISSIONS.ANALYTICS_FINANCIALS)) return placement;
    const { placementFee, feePercentage, salaryOffered, ...rest } = placement;
    return rest as T;
  }

  async findAll(query: any = {}, role?: string) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.companyId) where.company = { id: query.companyId };
    const placements = await this.repo.find({
      where,
      relations: this.relations,
      order: { createdAt: 'DESC' },
      take: Number(query.limit) || 50,
      skip: Number(query.offset) || 0,
    });
    return placements.map(p => this.redact(p, role));
  }

  async findById(id: string, role?: string) {
    const placement = await this.repo.findOne({ where: { id }, relations: this.relations });
    if (!placement) throw new NotFoundException('Placement not found');
    return this.redact(placement, role);
  }

  /**
   * Creating a placement closes the loop: the candidate moves to PLACED and the
   * job is marked FILLED, matching the placement pipeline in the plan.
   */
  async create(dto: CreatePlacementDto) {
    const fee =
      dto.salaryOffered && dto.feePercentage
        ? Math.round(dto.salaryOffered * (dto.feePercentage / 100) * 100) / 100
        : null;

    const placement = await this.repo.save(
      this.repo.create({
        candidate: { id: dto.candidateId } as any,
        job: { id: dto.jobId } as any,
        company: { id: dto.companyId } as any,
        startDate: dto.startDate as any,
        salaryOffered: dto.salaryOffered,
        feePercentage: dto.feePercentage,
        placementFee: fee,
        status: (dto.status as Placement['status']) || 'ACTIVE',
      }),
    );

    await this.candidateRepo.update(dto.candidateId, { status: 'PLACED' });
    await this.jobRepo.update(dto.jobId, { status: 'FILLED' });
    await this.pipelineRepo.save([
      this.pipelineRepo.create({
        entityType: 'CANDIDATE',
        entityId: dto.candidateId,
        stage: 'PLACED',
        previousStage: 'OFFERED',
        notes: 'Placement created',
      }),
      this.pipelineRepo.create({
        entityType: 'PLACEMENT',
        entityId: placement.id,
        stage: 'ACTIVE',
        notes: 'Placement started',
      }),
    ]);

    await this.applications.syncFromEvent(
      dto.candidateId, dto.jobId, 'HIRED', 'You got the job — congratulations',
    );

    return this.findById(placement.id);
  }

  async update(id: string, dto: UpdatePlacementDto) {
    const current = await this.findById(id);
    const salary = dto.salaryOffered ?? current.salaryOffered;
    const pct = dto.feePercentage ?? current.feePercentage;
    await this.repo.update(id, {
      ...(dto as unknown as Partial<Placement>),
      placementFee: salary && pct ? Math.round(salary * (pct / 100) * 100) / 100 : current.placementFee,
    });
    return this.findById(id);
  }

  async addFeedback(id: string, dto: FeedbackDto) {
    const placement = await this.findById(id);
    await this.repo.update(id, {
      satisfactionScore: dto.satisfactionScore ?? placement.satisfactionScore,
      clientFeedback: dto.clientFeedback
        ? { ...(placement.clientFeedback || {}), ...dto.clientFeedback }
        : placement.clientFeedback,
      candidateFeedback: dto.candidateFeedback
        ? { ...(placement.candidateFeedback || {}), ...dto.candidateFeedback }
        : placement.candidateFeedback,
    });
    return this.findById(id);
  }

  async remove(id: string) {
    await this.findById(id);
    // No FK from pipeline_stages (polymorphic entity_id), so clear history here.
    await this.pipelineRepo.delete({ entityType: 'PLACEMENT', entityId: id });
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
