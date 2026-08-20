import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Company } from '../../entities/company.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private repo: Repository<Company>,
    @InjectRepository(PipelineStage) private pipelineRepo: Repository<PipelineStage>,
  ) {}

  async findAll(query: any = {}) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.tier) where.tier = query.tier;
    if (query.search) where.name = ILike(`%${query.search}%`);
    return this.repo.find({
      where,
      relations: ['accountManager'],
      order: { createdAt: 'DESC' },
      take: Number(query.limit) || 50,
      skip: Number(query.offset) || 0,
    });
  }

  async findById(id: string) {
    const company = await this.repo.findOne({ where: { id }, relations: ['accountManager'] });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async create(dto: CreateCompanyDto) {
    const { accountManagerId, ...rest } = dto as CreateCompanyDto & { accountManagerId?: string };
    const slug = dto.slug || slugify(dto.name);
    if (await this.repo.findOne({ where: { slug } })) {
      throw new ConflictException(`A company with slug "${slug}" already exists`);
    }
    const company = this.repo.create({
      ...rest,
      slug,
      accountManager: accountManagerId ? ({ id: accountManagerId } as any) : null,
    } as Partial<Company>);
    const saved = await this.repo.save(company);

    await this.pipelineRepo.save(
      this.pipelineRepo.create({
        entityType: 'COMPANY',
        entityId: saved.id,
        stage: saved.status || 'LEAD',
        notes: 'Company created',
      }),
    );
    return saved;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const { accountManagerId, ...rest } = dto;
    await this.findById(id);
    await this.repo.update(id, {
      ...(rest as Partial<Company>),
      ...(accountManagerId !== undefined ? { accountManager: { id: accountManagerId } as any } : {}),
    });
    return this.findById(id);
  }

  /** Pipeline status change — also recorded in pipeline_stages for the audit trail. */
  async updateStatus(id: string, status: string, notes?: string, changedById?: string) {
    const company = await this.findById(id);
    await this.repo.update(id, { status: status as Company['status'] });
    await this.pipelineRepo.save(
      this.pipelineRepo.create({
        entityType: 'COMPANY',
        entityId: id,
        stage: status,
        previousStage: company.status,
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
    await this.pipelineRepo.delete({ entityType: 'COMPANY', entityId: id });
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
