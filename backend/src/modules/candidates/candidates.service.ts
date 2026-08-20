import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Candidate } from '../../entities/candidate.entity';
import { CandidateSkill } from '../../entities/candidate-skill.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { CreateCandidateDto, UpdateCandidateDto, SkillDto } from './dto/candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(Candidate) private repo: Repository<Candidate>,
    @InjectRepository(CandidateSkill) private skillRepo: Repository<CandidateSkill>,
    @InjectRepository(PipelineStage) private pipelineRepo: Repository<PipelineStage>,
  ) {}

  async findAll(query: any = {}) {
    const relations = ['skills', 'assignedRecruiter'];
    const take = Number(query.limit) || 50;
    const skip = Number(query.offset) || 0;

    if (query.search) {
      const like = ILike(`%${query.search}%`);
      const base = query.status ? { status: query.status } : {};
      return this.repo.find({
        where: [
          { ...base, firstName: like },
          { ...base, lastName: like },
          { ...base, email: like },
          { ...base, currentTitle: like },
        ],
        relations,
        order: { createdAt: 'DESC' },
        take,
        skip,
      });
    }

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.availability) where.availability = query.availability;
    return this.repo.find({ where, relations, order: { createdAt: 'DESC' }, take, skip });
  }

  async findById(id: string) {
    const candidate = await this.repo.findOne({ where: { id }, relations: ['skills', 'assignedRecruiter'] });
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate;
  }

  async create(dto: CreateCandidateDto) {
    const { assignedRecruiterId, skills, ...rest } = dto;
    if (await this.repo.findOne({ where: { email: dto.email } })) {
      throw new ConflictException(`A candidate with email ${dto.email} already exists`);
    }
    const candidate = await this.repo.save(
      this.repo.create({
        ...(rest as Partial<Candidate>),
        assignedRecruiter: assignedRecruiterId ? ({ id: assignedRecruiterId } as any) : null,
      }),
    );

    if (skills?.length) await this.setSkills(candidate.id, skills);
    await this.pipelineRepo.save(
      this.pipelineRepo.create({
        entityType: 'CANDIDATE',
        entityId: candidate.id,
        stage: candidate.status || 'UNASSIGNED',
        notes: 'Candidate created',
      }),
    );
    return this.findById(candidate.id);
  }

  async update(id: string, dto: UpdateCandidateDto) {
    const { assignedRecruiterId, skills, ...rest } = dto;
    await this.findById(id);
    await this.repo.update(id, {
      ...(rest as Partial<Candidate>),
      ...(assignedRecruiterId !== undefined ? { assignedRecruiter: { id: assignedRecruiterId } as any } : {}),
    });
    if (skills) await this.setSkills(id, skills);
    return this.findById(id);
  }

  /** Replaces the candidate's skill set. */
  async setSkills(id: string, skills: SkillDto[]) {
    await this.findById(id);
    await this.skillRepo.delete({ candidate: { id } as any });
    if (skills.length) {
      await this.skillRepo.save(
        skills.map(s => this.skillRepo.create({ ...s, candidate: { id } as any })),
      );
    }
    return this.findById(id);
  }

  /** Verification flags (identity, references, background check, ...). */
  async setVerification(id: string, flags: Record<string, boolean>, verifiedById?: string) {
    const candidate = await this.findById(id);
    await this.repo.update(id, {
      verifiedFlags: {
        ...(candidate.verifiedFlags || {}),
        ...flags,
        // Who signed off, so the record is auditable.
        verifiedBy: verifiedById,
        verifiedAt: new Date().toISOString(),
      } as any,
    });
    return this.findById(id);
  }

  async updateStatus(id: string, status: string, notes?: string, changedById?: string) {
    const candidate = await this.findById(id);
    await this.repo.update(id, { status: status as Candidate['status'] });
    await this.pipelineRepo.save(
      this.pipelineRepo.create({
        entityType: 'CANDIDATE',
        entityId: id,
        stage: status,
        previousStage: candidate.status,
        notes,
        changedBy: changedById ? ({ id: changedById } as any) : null,
      }),
    );
    return this.findById(id);
  }

  async remove(id: string) {
    await this.findById(id);
    // pipeline_stages references entities polymorphically, so there is no FK to
    // cascade — clear the history explicitly or the board shows orphaned cards.
    await this.pipelineRepo.delete({ entityType: 'CANDIDATE', entityId: id });
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
