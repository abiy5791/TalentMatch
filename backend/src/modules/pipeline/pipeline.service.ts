import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Company } from '../../entities/company.entity';
import { Placement } from '../../entities/placement.entity';
import { TransitionDto } from './dto/pipeline.dto';
import { hasPermission, Permission, PERMISSIONS } from '../auth/permissions';

type EntityType = 'COMPANY' | 'CANDIDATE' | 'PLACEMENT';

/**
 * Some moves are commercial rather than operational. A recruiter drives a
 * candidate through screening to offer, but marking them PLACED books a fee, and
 * company/placement stages track the client relationship — both manager calls.
 */
const STAGE_PERMISSION: Partial<Record<EntityType, Record<string, Permission>>> = {
  CANDIDATE: { PLACED: PERMISSIONS.PLACEMENTS_WRITE },
  COMPANY: {},
  PLACEMENT: {},
};

const TYPE_PERMISSION: Partial<Record<EntityType, Permission>> = {
  COMPANY: PERMISSIONS.COMPANIES_WRITE,
  PLACEMENT: PERMISSIONS.PLACEMENTS_WRITE,
};

/**
 * State machines from the implementation plan (§6.3). Each stage maps to the
 * stages it may move to; an empty list marks a terminal stage.
 */
const TRANSITIONS: Record<EntityType, Record<string, string[]>> = {
  COMPANY: {
    LEAD: ['ONBOARDED', 'REJECTED'],
    ONBOARDED: ['ACTIVE', 'INACTIVE'],
    ACTIVE: ['FULFILLED', 'INACTIVE'],
    FULFILLED: ['ACTIVE', 'INACTIVE'],
    INACTIVE: ['ACTIVE'],
    REJECTED: [],
  },
  CANDIDATE: {
    UNASSIGNED: ['SCREENING', 'ARCHIVED'],
    SCREENING: ['MATCHED', 'REJECTED', 'ARCHIVED'],
    MATCHED: ['SENT_TO_COMPANY', 'REJECTED', 'ARCHIVED'],
    SENT_TO_COMPANY: ['INTERVIEWING', 'REJECTED'],
    INTERVIEWING: ['OFFERED', 'REJECTED'],
    OFFERED: ['PLACED', 'REJECTED'],
    PLACED: ['ARCHIVED'],
    REJECTED: ['ARCHIVED', 'UNASSIGNED'],
    ARCHIVED: ['UNASSIGNED'],
  },
  PLACEMENT: {
    ACTIVE: ['COMPLETED', 'TERMINATED'],
    COMPLETED: ['ARCHIVED'],
    TERMINATED: ['ARCHIVED'],
    ARCHIVED: [],
  },
};

const ENTRY_STAGE: Record<EntityType, string> = {
  COMPANY: 'LEAD',
  CANDIDATE: 'UNASSIGNED',
  PLACEMENT: 'ACTIVE',
};

@Injectable()
export class PipelineService {
  constructor(
    @InjectRepository(PipelineStage) private repo: Repository<PipelineStage>,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    @InjectRepository(Placement) private placementRepo: Repository<Placement>,
  ) {}

  private normalizeType(entityType: string): EntityType {
    const type = (entityType || '').toUpperCase() as EntityType;
    if (!TRANSITIONS[type]) {
      throw new BadRequestException(
        `Unknown entity type "${entityType}". Expected COMPANY, CANDIDATE or PLACEMENT.`,
      );
    }
    return type;
  }

  /** Latest stage per entity, with the entity's display name resolved. */
  async getPipeline(entityType: string, role?: string) {
    const type = this.normalizeType(entityType);
    const stages = await this.repo.find({
      where: { entityType: type },
      relations: ['changedBy'],
      order: { createdAt: 'DESC' },
    });

    const latest = new Map<string, PipelineStage>();
    for (const s of stages) {
      const seen = latest.get(s.entityId);
      if (!seen || seen.createdAt < s.createdAt) latest.set(s.entityId, s);
    }

    const current = Array.from(latest.values());
    const names = await this.resolveNames(type, current.map(s => s.entityId));
    // Skip stages whose entity no longer exists — entity_id is polymorphic, so
    // the database cannot enforce this with a foreign key.
    return current
      .filter(s => names.has(s.entityId))
      .map(s => ({
        ...s,
        entityName: names.get(s.entityId),
        // Only offer moves this caller is actually allowed to make.
        nextStages: (TRANSITIONS[type][s.stage] || []).filter(next =>
          this.canMoveTo(type, next, role),
        ),
      }));
  }

  async getEntityStages(entityType: string, entityId: string) {
    const type = this.normalizeType(entityType);
    return this.repo.find({
      where: { entityType: type, entityId },
      relations: ['changedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async transition(dto: TransitionDto, role?: string) {
    const type = this.normalizeType(dto.entityType);
    const allowed = TRANSITIONS[type];

    if (role && !this.canMoveTo(type, dto.stage, role)) {
      const needed = TYPE_PERMISSION[type] || STAGE_PERMISSION[type]?.[dto.stage];
      throw new ForbiddenException(
        `Your role cannot move a ${type} to ${dto.stage} (requires ${needed})`,
      );
    }

    if (!allowed[dto.stage]) {
      throw new BadRequestException(
        `"${dto.stage}" is not a valid ${type} stage. Valid stages: ${Object.keys(allowed).join(', ')}`,
      );
    }

    const names = await this.resolveNames(type, [dto.entityId]);
    if (!names.has(dto.entityId)) {
      throw new NotFoundException(`${type} ${dto.entityId} not found`);
    }

    const [latest] = await this.repo.find({
      where: { entityType: type, entityId: dto.entityId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const previousStage = latest?.stage || ENTRY_STAGE[type];

    if (latest && !(allowed[previousStage] || []).includes(dto.stage)) {
      throw new BadRequestException(
        `Cannot move ${type} from ${previousStage} to ${dto.stage}. ` +
          `Allowed: ${(allowed[previousStage] || []).join(', ') || 'none (terminal stage)'}`,
      );
    }

    const stage = await this.repo.save(
      this.repo.create({
        entityType: type,
        entityId: dto.entityId,
        stage: dto.stage,
        previousStage,
        notes: dto.notes,
        changedBy: dto.changedById ? ({ id: dto.changedById } as any) : null,
      }),
    );

    await this.syncEntityStatus(type, dto.entityId, dto.stage);
    return { ...stage, entityName: names.get(dto.entityId), nextStages: allowed[dto.stage] || [] };
  }

  /** A role with no explicit requirement for the target stage may always move it. */
  private canMoveTo(type: EntityType, stage: string, role?: string): boolean {
    if (!role) return true;
    const needed = TYPE_PERMISSION[type] || STAGE_PERMISSION[type]?.[stage];
    return !needed || hasPermission(role, needed);
  }

  async getStageCounts(entityType: string) {
    const type = this.normalizeType(entityType);
    const stages = await this.getPipeline(type);
    const counts: Record<string, number> = {};
    for (const stage of Object.keys(TRANSITIONS[type])) counts[stage] = 0;
    for (const s of stages) counts[s.stage] = (counts[s.stage] || 0) + 1;
    return counts;
  }

  getStageDefinitions() {
    return Object.entries(TRANSITIONS).map(([entityType, stages]) => ({
      entityType,
      entryStage: ENTRY_STAGE[entityType as EntityType],
      stages: Object.entries(stages).map(([stage, next]) => ({ stage, next })),
    }));
  }

  /** Keeps the denormalized status column on the entity in step with its pipeline. */
  private async syncEntityStatus(type: EntityType, entityId: string, stage: string) {
    if (type === 'CANDIDATE' && stage !== 'REJECTED') {
      await this.candidateRepo.update(entityId, { status: stage as Candidate['status'] });
    } else if (type === 'COMPANY' && stage !== 'REJECTED') {
      await this.companyRepo.update(entityId, { status: stage as Company['status'] });
    } else if (type === 'PLACEMENT' && stage !== 'ARCHIVED') {
      await this.placementRepo.update(entityId, { status: stage as Placement['status'] });
    }
  }

  private async resolveNames(type: EntityType, ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (!ids.length) return names;

    if (type === 'CANDIDATE') {
      const rows = await this.candidateRepo.find({ where: { id: In(ids) } });
      rows.forEach(r => names.set(r.id, `${r.firstName} ${r.lastName}`));
    } else if (type === 'COMPANY') {
      const rows = await this.companyRepo.find({ where: { id: In(ids) } });
      rows.forEach(r => names.set(r.id, r.name));
    } else {
      const rows = await this.placementRepo.find({
        where: { id: In(ids) },
        relations: ['candidate', 'company'],
      });
      rows.forEach(r =>
        names.set(
          r.id,
          `${r.candidate?.firstName ?? ''} ${r.candidate?.lastName ?? ''} @ ${r.company?.name ?? ''}`.trim(),
        ),
      );
    }
    return names;
  }
}
