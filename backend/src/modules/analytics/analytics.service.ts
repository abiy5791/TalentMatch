import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { Candidate } from '../../entities/candidate.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { Placement } from '../../entities/placement.entity';
import { Company } from '../../entities/company.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { hasPermission, PERMISSIONS } from '../auth/permissions';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(JobPosting) private jobRepo: Repository<JobPosting>,
    @InjectRepository(Placement) private placementRepo: Repository<Placement>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    @InjectRepository(PipelineStage) private pipelineRepo: Repository<PipelineStage>,
    private dataSource: DataSource,
  ) {}

  async getDashboardMetrics() {
    const [totalCandidates, totalJobs, totalCompanies, totalPlacements, activeJobs] = await Promise.all([
      this.candidateRepo.count(),
      this.jobRepo.count(),
      this.companyRepo.count(),
      this.placementRepo.count(),
      this.jobRepo.count({ where: { status: 'LIVE' } }),
    ]);
    return { totalCandidates, totalJobs, totalCompanies, totalPlacements, activeJobs };
  }

  async getPipelineSummary() {
    const candidateStages = await this.pipelineRepo.find({ where: { entityType: 'CANDIDATE' }, order: { createdAt: 'DESC' } });
    const companyStages = await this.pipelineRepo.find({ where: { entityType: 'COMPANY' }, order: { createdAt: 'DESC' } });
    const latestCandidates = new Map();
    const latestCompanies = new Map();
    for (const s of candidateStages) {
      if (!latestCandidates.has(s.entityId)) latestCandidates.set(s.entityId, s.stage);
    }
    for (const s of companyStages) {
      if (!latestCompanies.has(s.entityId)) latestCompanies.set(s.entityId, s.stage);
    }
    const candidateCounts: Record<string, number> = {};
    const companyCounts: Record<string, number> = {};
    for (const v of latestCandidates.values()) candidateCounts[v] = (candidateCounts[v] || 0) + 1;
    for (const v of latestCompanies.values()) companyCounts[v] = (companyCounts[v] || 0) + 1;
    return { candidates: candidateCounts, companies: companyCounts };
  }

  async getGapAnalysis() {
    const query = `
      WITH skill_demand AS (
        SELECT
          jsonb_array_elements(required_skills)->>'name' AS skill,
          COUNT(*)::int AS job_count
        FROM job_postings
        WHERE status IN ('LIVE', 'APPROVED')
        GROUP BY skill
      ),
      skill_supply AS (
        SELECT
          skill_name AS skill,
          COUNT(*)::int AS candidate_count
        FROM candidate_skills
        WHERE candidate_id IN (
          SELECT id FROM candidates
          WHERE status IN ('SCREENING', 'MATCHED', 'SENT_TO_COMPANY', 'INTERVIEWING', 'OFFERED')
        )
        GROUP BY skill_name
      )
      SELECT
        d.skill,
        d.job_count,
        COALESCE(s.candidate_count, 0) AS candidate_count,
        d.job_count - COALESCE(s.candidate_count, 0) AS gap,
        CASE
          WHEN d.job_count > COALESCE(s.candidate_count, 0) * 2 THEN 'CRITICAL'
          WHEN d.job_count > COALESCE(s.candidate_count, 0) THEN 'HIGH'
          ELSE 'NORMAL'
        END AS severity
      FROM skill_demand d
      LEFT JOIN skill_supply s ON lower(d.skill) = lower(s.skill)
      WHERE d.skill IS NOT NULL
      ORDER BY gap DESC, d.job_count DESC
      LIMIT 20
    `;
    return this.dataSource.query(query);
  }

  async getCompanyTierDistribution() {
    return this.dataSource.query(
      `SELECT tier, COUNT(*)::int AS count FROM companies GROUP BY tier ORDER BY count DESC`,
    );
  }

  /**
   * Fee totals are a sum, so they need one currency to render in. Take the one
   * the placed roles were actually advertised in rather than assuming a symbol,
   * falling back to whatever the board is mostly posted in.
   */
  private async feeCurrency(): Promise<string> {
    const [placed] = await this.dataSource.query(`
      SELECT j.currency AS currency
      FROM placements p
      JOIN job_postings j ON j.id = p.job_id
      WHERE j.currency IS NOT NULL
      GROUP BY j.currency
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `);
    if (placed?.currency) return placed.currency;
    const [posted] = await this.dataSource.query(`
      SELECT currency
      FROM job_postings
      WHERE currency IS NOT NULL
      GROUP BY currency
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `);
    return posted?.currency || 'ETB';
  }

  /** Placement success rate = placements / candidates that reached a client. */
  async getPlacementMetrics(role?: string) {
    const [row] = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PLACED')::int AS placed,
        COUNT(*) FILTER (WHERE status IN ('SENT_TO_COMPANY', 'INTERVIEWING', 'OFFERED', 'PLACED'))::int AS sent_to_client
      FROM candidates
    `);
    const [fees] = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(placement_fee), 0)::float AS total_fees,
        COALESCE(AVG(satisfaction_score), 0)::float AS avg_satisfaction,
        COUNT(*)::int AS total
      FROM placements
    `);
    const successRate = row.sent_to_client ? (row.placed / row.sent_to_client) * 100 : 0;
    const metrics = {
      placed: row.placed,
      sentToClient: row.sent_to_client,
      successRate: Math.round(successRate * 10) / 10,
      totalPlacements: fees.total,
      avgSatisfaction: Math.round(fees.avg_satisfaction * 10) / 10,
    };

    // Revenue is a commercial figure — only for roles with analytics:financials.
    if (role && !hasPermission(role, PERMISSIONS.ANALYTICS_FINANCIALS)) return metrics;
    return { ...metrics, totalFees: fees.total_fees, currency: await this.feeCurrency() };
  }

  /** Fees by client and by month — managers and admins only. */
  async getRevenueBreakdown() {
    const byClient = await this.dataSource.query(`
      SELECT
        c.name AS company,
        c.tier,
        COUNT(p.id)::int AS placements,
        COALESCE(SUM(p.placement_fee), 0)::float AS fees
      FROM placements p
      JOIN companies c ON c.id = p.company_id
      GROUP BY c.name, c.tier
      ORDER BY fees DESC
      LIMIT 20
    `);
    const byMonth = await this.dataSource.query(`
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS placements,
        COALESCE(SUM(placement_fee), 0)::float AS fees
      FROM placements
      GROUP BY 1
      ORDER BY 1
    `);
    return { byClient, byMonth, currency: await this.feeCurrency() };
  }

  /** Average days between job creation and the placement made against it. */
  async getTimeToFill() {
    return this.dataSource.query(`
      SELECT
        COALESCE(c.industry, 'Unknown') AS industry,
        ROUND(AVG(EXTRACT(EPOCH FROM (p.created_at - j.created_at)) / 86400)::numeric, 1)::float AS avg_days,
        COUNT(*)::int AS placements
      FROM placements p
      JOIN job_postings j ON j.id = p.job_id
      LEFT JOIN companies c ON c.id = p.company_id
      GROUP BY c.industry
      ORDER BY placements DESC
    `);
  }

  async getRecentActivity(days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const [newCandidates, newJobs, newCompanies, newPlacements] = await Promise.all([
      this.candidateRepo.count({ where: { createdAt: MoreThanOrEqual(since) } }),
      this.jobRepo.count({ where: { createdAt: MoreThanOrEqual(since) } }),
      this.companyRepo.count({ where: { createdAt: MoreThanOrEqual(since) } }),
      this.placementRepo.count({ where: { createdAt: MoreThanOrEqual(since) } }),
    ]);
    return { newCandidates, newJobs, newCompanies, newPlacements, period: `${days}d` };
  }
}
