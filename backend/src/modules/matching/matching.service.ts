import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { MatchScore } from '../../entities/match-score.entity';
import { Candidate } from '../../entities/candidate.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { Notification } from '../../entities/notification.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { CandidateDispatch } from '../../entities/candidate-dispatch.entity';
import { AppSetting } from '../../entities/app-setting.entity';
import {
  DEFAULT_WEIGHTS, MatchWeights, UpdateWeightsDto, WEIGHT_FACTORS,
} from './dto/weights.dto';
import { DispatchDto } from './dto/dispatch.dto';
import { ApplicationsService } from '../applications/applications.service';

const ALGORITHM_VERSION = 'v2.1';

/** Key under which the tunable factor weights live in app_settings. */
const WEIGHTS_KEY = 'matching.weights';

@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(MatchScore) private matchRepo: Repository<MatchScore>,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(JobPosting) private jobRepo: Repository<JobPosting>,
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @InjectRepository(PipelineStage) private pipelineRepo: Repository<PipelineStage>,
    @InjectRepository(CandidateDispatch) private dispatchRepo: Repository<CandidateDispatch>,
    @InjectRepository(AppSetting) private settingRepo: Repository<AppSetting>,
    private applications: ApplicationsService,
    private dataSource: DataSource,
  ) {}

  /**
   * Stored weights, or the shipped defaults when an operator has never saved
   * any. Values are relative shares, not required to total 100.
   */
  async getWeights() {
    const row = await this.settingRepo.findOne({
      where: { key: WEIGHTS_KEY },
      relations: ['updatedBy'],
    });
    const stored = row?.value as Partial<MatchWeights> | undefined;

    // A factor added to the code after a save would be missing from the stored
    // object, so fall back per factor rather than for the record as a whole.
    const weights = WEIGHT_FACTORS.reduce((acc, factor) => {
      const value = Number(stored?.[factor]);
      acc[factor] = Number.isFinite(value) && value >= 0 ? value : DEFAULT_WEIGHTS[factor];
      return acc;
    }, {} as MatchWeights);

    return {
      weights,
      normalized: this.normalize(weights),
      defaults: DEFAULT_WEIGHTS,
      isDefault: !row,
      algorithmVersion: ALGORITHM_VERSION,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy
        ? {
            id: row.updatedBy.id,
            firstName: row.updatedBy.firstName,
            lastName: row.updatedBy.lastName,
          }
        : null,
    };
  }

  async updateWeights(dto: UpdateWeightsDto, updatedById?: string) {
    const weights = WEIGHT_FACTORS.reduce((acc, factor) => {
      acc[factor] = Number(dto[factor]);
      return acc;
    }, {} as MatchWeights);

    const total = WEIGHT_FACTORS.reduce((sum, factor) => sum + weights[factor], 0);
    if (total <= 0) {
      throw new BadRequestException('At least one factor must carry a weight above zero');
    }

    await this.settingRepo.save({
      key: WEIGHTS_KEY,
      value: weights,
      updatedBy: updatedById ? ({ id: updatedById } as any) : null,
    });

    // Scores already on record were produced with the previous weights; they
    // stay put until a recalculation is run, so say so rather than implying the
    // whole board has moved.
    const staleScores = await this.matchRepo.count();
    return { ...(await this.getWeights()), staleScores };
  }

  /** Restores the shipped defaults by dropping the override entirely. */
  async resetWeights() {
    await this.settingRepo.delete({ key: WEIGHTS_KEY });
    return this.getWeights();
  }

  /** Relative shares -> fractions summing to 1, which is what scoring needs. */
  private normalize(weights: MatchWeights): MatchWeights {
    const total = WEIGHT_FACTORS.reduce((sum, factor) => sum + (weights[factor] || 0), 0);
    if (total <= 0) return { ...DEFAULT_WEIGHTS };
    return WEIGHT_FACTORS.reduce((acc, factor) => {
      acc[factor] = (weights[factor] || 0) / total;
      return acc;
    }, {} as MatchWeights);
  }

  async calculateForJob(jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId }, relations: ['company'] });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    const candidates = await this.candidateRepo.find({ relations: ['skills'] });
    return this.persist(candidates.map(c => ({ candidate: c, job })));
  }

  async calculateForCandidate(candidateId: string) {
    const candidate = await this.candidateRepo.findOne({ where: { id: candidateId }, relations: ['skills'] });
    if (!candidate) throw new NotFoundException(`Candidate ${candidateId} not found`);
    const jobs = await this.jobRepo.find({ relations: ['company'] });
    return this.persist(jobs.map(job => ({ candidate, job })));
  }

  /** Recalculates the full matrix — used after seeding and by the "Recalculate all" action. */
  async calculateAll() {
    const [candidates, jobs] = await Promise.all([
      this.candidateRepo.find({ relations: ['skills'] }),
      this.jobRepo.find({ relations: ['company'] }),
    ]);
    const pairs = jobs.flatMap(job => candidates.map(candidate => ({ candidate, job })));
    const saved = await this.persist(pairs);
    return { calculated: saved.length, candidates: candidates.length, jobs: jobs.length };
  }

  /**
   * match_scores has UNIQUE(candidate_id, job_id), so a re-run must overwrite the
   * existing row instead of inserting a duplicate. Existing rows are loaded once
   * and reused by id rather than issuing a lookup per pair.
   */
  private async persist(pairs: { candidate: Candidate; job: JobPosting }[]) {
    if (!pairs.length) return [];

    // Read once per run: every pair in a batch is then scored against the same
    // weight set even if an operator saves new weights mid-calculation.
    const { normalized, weights } = await this.getWeights();

    const existing = await this.matchRepo.find({
      where: pairs.map(({ candidate, job }) => ({
        candidate: { id: candidate.id },
        job: { id: job.id },
      })),
      loadRelationIds: { relations: ['candidate', 'job'] },
    });
    const byPair = new Map<string, string>(
      existing.map(m => [`${m.candidate as unknown as string}:${m.job as unknown as string}`, m.id]),
    );

    const rows = pairs.map(({ candidate, job }) => ({
      id: byPair.get(`${candidate.id}:${job.id}`),
      candidate: { id: candidate.id } as Candidate,
      job: { id: job.id } as JobPosting,
      algorithmVersion: ALGORITHM_VERSION,
      status: 'ACTIVE',
      ...this.computeMatch(candidate, job, normalized, weights),
    }));

    await this.matchRepo.save(rows as MatchScore[], { chunk: 100 });

    return this.matchRepo.find({
      where: pairs.map(({ candidate, job }) => ({
        candidate: { id: candidate.id },
        job: { id: job.id },
      })),
      relations: ['candidate', 'job', 'job.company'],
      order: { overallScore: 'DESC' },
    });
  }

  async findMatchesForJob(jobId: string) {
    return this.matchRepo.find({
      where: { job: { id: jobId } },
      relations: ['candidate', 'candidate.skills'],
      order: { overallScore: 'DESC' },
    });
  }

  async findMatchesForCandidate(candidateId: string) {
    return this.matchRepo.find({
      where: { candidate: { id: candidateId } },
      relations: ['job', 'job.company'],
      order: { overallScore: 'DESC' },
    });
  }

  async getAll(query: any = {}) {
    const where: any = {};
    if (query.jobId) where.job = { id: query.jobId };
    if (query.candidateId) where.candidate = { id: query.candidateId };
    const matches = await this.matchRepo.find({
      where,
      relations: ['candidate', 'candidate.skills', 'job', 'job.company'],
      order: { overallScore: 'DESC' },
      take: Number(query.limit) || 100,
    });
    const min = Number(query.minScore);
    return Number.isFinite(min) ? matches.filter(m => m.overallScore >= min) : matches;
  }

  /**
   * Direct talent dispatch (plan §6.4): pushes selected candidates to the hiring
   * company, records the notification and advances each candidate's pipeline.
   */
  async dispatch(dto: DispatchDto, dispatchedById?: string) {
    const job = await this.jobRepo.findOne({
      where: { id: dto.jobId },
      relations: ['company', 'company.accountManager'],
    });
    if (!job) throw new NotFoundException(`Job ${dto.jobId} not found`);

    const candidates = await this.candidateRepo.find({ where: { id: In(dto.candidateIds) } });
    if (candidates.length !== dto.candidateIds.length) {
      throw new BadRequestException('One or more candidates could not be found');
    }

    const method = dto.method || 'DASHBOARD';
    const names = candidates.map(c => `${c.firstName} ${c.lastName}`).join(', ');
    // Prefer the client's account manager; fall back to whoever dispatched.
    const recipientId = job.company?.accountManager?.id || dispatchedById;
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient: recipientId ? ({ id: recipientId } as any) : null,
        recipientEmail: dto.recipientEmail,
        type: 'TALENT_DISPATCH',
        category: 'MATCHING',
        subject: `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} for ${job.title}`,
        content: dto.message || `${names} dispatched for ${job.title} at ${job.company?.name}.`,
        metadata: {
          jobId: job.id,
          companyId: job.company?.id,
          candidateIds: dto.candidateIds,
          method,
          dispatchedById,
        },
        status: method === 'DASHBOARD' ? 'DELIVERED' : 'PENDING',
        sentAt: new Date(),
      }),
    );

    // The dispatch rows are what make these candidates visible in the client
    // portal, and they carry the employer's response back.
    for (const candidate of candidates) {
      const existing = await this.dispatchRepo.findOne({
        where: { candidate: { id: candidate.id }, job: { id: job.id } },
      });
      await this.dispatchRepo.save({
        ...(existing ? { id: existing.id } : {}),
        candidate: { id: candidate.id } as any,
        job: { id: job.id } as any,
        company: { id: job.company?.id } as any,
        message: dto.message,
        // Re-sending a candidate puts them back in front of the client.
        status: 'SENT',
        viewedAt: null,
        respondedAt: null,
        dispatchedBy: dispatchedById ? ({ id: dispatchedById } as any) : null,
      });
    }

    // SENT_TO_COMPANY is only reachable from MATCHED in the candidate state machine.
    const advanced = candidates.filter(c => ['MATCHED', 'SCREENING'].includes(c.status));
    if (advanced.length) {
      await this.candidateRepo.update(
        { id: In(advanced.map(c => c.id)) },
        { status: 'SENT_TO_COMPANY' },
      );
      await this.pipelineRepo.save(
        advanced.map(c =>
          this.pipelineRepo.create({
            entityType: 'CANDIDATE',
            entityId: c.id,
            stage: 'SENT_TO_COMPANY',
            previousStage: c.status,
            notes: `Dispatched to ${job.company?.name} for ${job.title}`,
            changedBy: dispatchedById ? ({ id: dispatchedById } as any) : null,
          }),
        ),
      );
    }

    // If they applied for this role themselves, tell them it went to the client.
    for (const candidate of candidates) {
      await this.applications.syncFromEvent(
        candidate.id, job.id, 'SHORTLISTED',
        `Your profile was shared with ${job.company?.name}`,
      );
    }

    return {
      dispatchedCount: candidates.length,
      advancedCount: advanced.length,
      method,
      trackingId: notification.id,
      job: { id: job.id, title: job.title, company: job.company?.name },
    };
  }

  /** What clients have done with the candidates sent to them. */
  async getDispatches(query: any = {}) {
    const where: any = {};
    if (query.jobId) where.job = { id: query.jobId };
    if (query.companyId) where.company = { id: query.companyId };
    if (query.status) where.status = query.status;
    const dispatches = await this.dispatchRepo.find({
      where,
      relations: ['candidate', 'job', 'company'],
      order: { createdAt: 'DESC' },
      take: Number(query.limit) || 100,
    });
    return dispatches.map(d => ({
      id: d.id,
      status: d.status,
      clientNote: d.clientNote,
      submittedAt: d.createdAt,
      viewedAt: d.viewedAt,
      respondedAt: d.respondedAt,
      candidate: d.candidate
        ? { id: d.candidate.id, firstName: d.candidate.firstName, lastName: d.candidate.lastName }
        : null,
      job: d.job ? { id: d.job.id, title: d.job.title } : null,
      company: d.company ? { id: d.company.id, name: d.company.name } : null,
    }));
  }

  /** Batch dispatch: takes the top N scoring candidates for a job. */
  async batchDispatch(jobId: string, topN = 5, message?: string, dispatchedById?: string) {
    const matches = await this.matchRepo.find({
      where: { job: { id: jobId } },
      relations: ['candidate'],
      order: { overallScore: 'DESC' },
      take: topN,
    });
    if (!matches.length) {
      throw new BadRequestException('No match scores for this job — run a calculation first');
    }
    return this.dispatch(
      { jobId, candidateIds: matches.map(m => m.candidate.id), method: 'DASHBOARD', message },
      dispatchedById,
    );
  }

  private computeMatch(
    candidate: Candidate,
    job: JobPosting,
    weights: MatchWeights,
    rawWeights: MatchWeights,
  ) {
    const skillScore = this.skillMatch(candidate, job);
    const expScore = this.experienceMatch(candidate, job);
    const locScore = this.locationMatch(candidate, job);
    const salScore = this.salaryMatch(candidate, job);
    const culScore = this.cultureMatch(candidate, job);
    const avaScore = this.availabilityMatch(candidate, job);
    const overall = (
      skillScore * weights.skills +
      expScore * weights.experience +
      locScore * weights.location +
      salScore * weights.salary +
      culScore * weights.culture +
      avaScore * weights.availability
    );
    return {
      overallScore: Math.round(overall * 100) / 100,
      skillMatchScore: Math.round(skillScore * 100) / 100,
      locationMatchScore: Math.round(locScore * 100) / 100,
      salaryMatchScore: Math.round(salScore * 100) / 100,
      experienceMatchScore: Math.round(expScore * 100) / 100,
      cultureMatchScore: Math.round(culScore * 100) / 100,
      factorBreakdown: {
        skills: skillScore,
        experience: expScore,
        location: locScore,
        salary: salScore,
        culture: culScore,
        availability: avaScore,
        // Kept with the score so it stays explainable after the weights change.
        weightsUsed: rawWeights,
      },
    };
  }

  private skillMatch(candidate: Candidate, job: JobPosting): number {
    const required = job.requiredSkills || [];
    if (!required.length) return 50;
    const cSkills = new Map((candidate.skills || []).map(s => [s.skillName.toLowerCase(), s.proficiencyLevel || 3]));
    let matches = 0;
    for (const req of required) {
      const name = (req.name || '').toLowerCase();
      const reqLevel = req.level || 3;
      if (cSkills.has(name)) {
        const cLevel = cSkills.get(name) || 1;
        matches += Math.min(cLevel / reqLevel, 1.0);
      }
    }
    return (matches / required.length) * 100;
  }

  private experienceMatch(candidate: Candidate, job: JobPosting): number {
    const minExp = 2;
    const idealExp = 5;
    const cExp = candidate.experienceYears || 0;
    if (cExp >= idealExp) return 100;
    if (cExp >= minExp) return 60 + ((cExp - minExp) / (idealExp - minExp)) * 40;
    return (cExp / minExp) * 60;
  }

  private locationMatch(candidate: Candidate, job: JobPosting): number {
    const cLoc = candidate.location || {};
    const jLoc = job.location || {};
    if (!cLoc.city && !jLoc.city) return 70;
    if (cLoc.city === jLoc.city) return 100;
    if (cLoc.country === jLoc.country) return 70;
    if (jLoc.remote) return 80;
    return 40;
  }

  private salaryMatch(candidate: Candidate, job: JobPosting): number {
    const cMin = candidate.salaryExpectationMin || 0;
    const cMax = candidate.salaryExpectationMax || 999999;
    const jMin = job.salaryMin || 0;
    const jMax = job.salaryMax || 999999;
    if (!jMin && !jMax) return 70;
    const overlap = Math.max(0, Math.min(cMax, jMax) - Math.max(cMin, jMin));
    const range = Math.max(cMax - cMin, jMax - jMin, 1);
    return Math.min((overlap / range) * 100 * 2, 100);
  }

  private cultureMatch(candidate: Candidate, job: JobPosting): number {
    const jTags = (job.company?.cultureTags || []) as string[];
    if (!jTags.length) return 70;
    const cData = candidate.resumeParsedData || {};
    const cInterests = (cData.interests || []) as string[];
    const overlap = jTags.filter(t => cInterests.some(c => c.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(c.toLowerCase()))).length;
    return Math.min((overlap / jTags.length) * 100 * 1.5, 100) || 50;
  }

  private availabilityMatch(candidate: Candidate, job: JobPosting): number {
    const map: Record<string, number> = { IMMEDIATE: 100, ONE_WEEK: 90, TWO_WEEKS: 80, ONE_MONTH: 60, TWO_MONTHS: 40 };
    return map[candidate.availability] || 50;
  }
}
