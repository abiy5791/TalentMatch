import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { Candidate } from '../entities/candidate.entity';
import { CandidateSkill } from '../entities/candidate-skill.entity';
import { JobPosting } from '../entities/job-posting.entity';
import { PipelineStage } from '../entities/pipeline-stage.entity';
import { Placement } from '../entities/placement.entity';
import { CandidateDispatch } from '../entities/candidate-dispatch.entity';
import { Application } from '../entities/application.entity';
import { MatchingService } from '../modules/matching/matching.service';

/**
 * Demo dataset for an Ethiopian recruitment desk: Addis Ababa and the regional
 * cities, salaries in birr, and clients drawn from the sectors that actually
 * hire technical people here — telecom-adjacent software, energy, fintech,
 * health and an early-stage AI team.
 *
 * Companies and candidates are invented. Only the geography, the currency and
 * the salary bands are meant to be true to life.
 */
const CURRENCY = 'ETB';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(CandidateSkill) private skillRepo: Repository<CandidateSkill>,
    @InjectRepository(JobPosting) private jobRepo: Repository<JobPosting>,
    @InjectRepository(PipelineStage) private pipelineRepo: Repository<PipelineStage>,
    @InjectRepository(Placement) private placementRepo: Repository<Placement>,
    @InjectRepository(CandidateDispatch) private dispatchRepo: Repository<CandidateDispatch>,
    @InjectRepository(Application) private applicationRepo: Repository<Application>,
    private matchingService: MatchingService,
    private dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.userRepo.count();
    if (count > 0) {
      console.log('Database already seeded, skipping...');
      return;
    }
    console.log('Seeding database...');
    await this.seed();
    const matches = await this.matchingService.calculateAll();
    console.log(`Database seeded successfully! (${matches.calculated} match scores calculated)`);
  }

  async seed() {
    // Users
    const hash = (pwd: string) => bcrypt.hashSync(pwd, 10);
    const admin = await this.userRepo.save(this.userRepo.create({ email: 'admin@talentmatch.io', passwordHash: hash('admin123'), role: 'SUPER_ADMIN', firstName: 'Selam', lastName: 'Bekele', status: 'ACTIVE' }));
    const manager = await this.userRepo.save(this.userRepo.create({ email: 'manager@talentmatch.io', passwordHash: hash('manager123'), role: 'MANAGER', firstName: 'Meron', lastName: 'Tadesse', status: 'ACTIVE' }));
    const recruiter = await this.userRepo.save(this.userRepo.create({ email: 'recruiter@talentmatch.io', passwordHash: hash('recruiter123'), role: 'RECRUITER', firstName: 'Yonas', lastName: 'Girma', status: 'ACTIVE' }));

    // Companies
    const companies = await this.companyRepo.save([
      { accountManager: manager, name: 'Habesha Tech Group', slug: 'habesha-tech-group', industry: 'Technology', size: '501-1000', location: { city: 'Addis Ababa', country: 'Ethiopia' }, tier: 'VIP', status: 'ACTIVE', description: 'Enterprise software built in Addis Ababa for banks and telecom operators across the Horn of Africa.', cultureTags: ['innovative', 'fast-paced', 'remote-friendly'] },
      { accountManager: recruiter, name: 'Rift Valley Energy', slug: 'rift-valley-energy', industry: 'Renewable Energy', size: '201-500', location: { city: 'Adama', country: 'Ethiopia' }, tier: 'STANDARD', status: 'ACTIVE', description: 'Geothermal and solar developer operating along the Ethiopian Rift Valley.', cultureTags: ['sustainable', 'mission-driven'] },
      { accountManager: manager, name: 'Chaka Financial Technologies', slug: 'chaka-financial-technologies', industry: 'Fintech', size: '51-200', location: { city: 'Addis Ababa', country: 'Ethiopia' }, tier: 'RETAINER', status: 'ACTIVE', description: 'Mobile payments and merchant settlement for Ethiopian businesses.', cultureTags: ['data-driven', 'agile'] },
      { accountManager: recruiter, name: 'Tena Health Systems', slug: 'tena-health-systems', industry: 'Healthcare', size: '1000+', location: { city: 'Bahir Dar', country: 'Ethiopia' }, tier: 'STANDARD', status: 'ONBOARDED', description: 'Digital patient records for regional hospitals and rural health posts.', cultureTags: ['patient-first', 'collaborative'] },
      { accountManager: recruiter, name: 'Sheba Analytics', slug: 'sheba-analytics', industry: 'Technology', size: '11-50', location: { city: 'Hawassa', country: 'Ethiopia' }, tier: 'STANDARD', status: 'LEAD', description: 'Early-stage team building Amharic and Afaan Oromo language models.', cultureTags: ['startup-vibes'] },
    ]);

    // Candidates. Salary expectations are annual birr — roughly 50k–120k ETB a
    // month, which is where the Addis technical market sits.
    const candidates = await this.candidateRepo.save([
      { resumeParsedData: { interests: ['innovative', 'remote-friendly', 'fast-paced'] }, firstName: 'Abebech', lastName: 'Tesfaye', email: 'abebech@example.com', phone: '+251-911-450-101', location: { city: 'Addis Ababa', country: 'Ethiopia' }, currentTitle: 'Senior Frontend Engineer', currentCompany: 'Anbessa Software', experienceYears: 8, currency: CURRENCY, salaryExpectationMin: 900000, salaryExpectationMax: 1260000, status: 'MATCHED', noticePeriodDays: 30, availability: 'IMMEDIATE', source: 'LinkedIn' },
      { resumeParsedData: { interests: ['sustainable', 'mission-driven'] }, firstName: 'Bereket', lastName: 'Alemu', email: 'bereket@example.com', phone: '+251-911-450-102', location: { city: 'Adama', country: 'Ethiopia' }, currentTitle: 'Backend Developer', currentCompany: 'Lalibela Labs', experienceYears: 5, currency: CURRENCY, salaryExpectationMin: 660000, salaryExpectationMax: 900000, status: 'SCREENING', noticePeriodDays: 60, availability: 'TWO_WEEKS', source: 'Referral' },
      { resumeParsedData: { interests: ['data-driven', 'agile'] }, firstName: 'Kalkidan', lastName: 'Getachew', email: 'kalkidan@example.com', phone: '+251-911-450-103', location: { city: 'Addis Ababa', country: 'Ethiopia' }, currentTitle: 'Data Scientist', currentCompany: 'Entoto Systems', experienceYears: 6, currency: CURRENCY, salaryExpectationMin: 840000, salaryExpectationMax: 1200000, status: 'SENT_TO_COMPANY', noticePeriodDays: 14, availability: 'IMMEDIATE', source: 'Direct' },
      { resumeParsedData: { interests: ['innovative', 'remote-friendly'] }, firstName: 'Dawit', lastName: 'Haile', email: 'dawit@example.com', phone: '+251-911-450-104', location: { city: 'Addis Ababa', country: 'Ethiopia' }, currentTitle: 'DevOps Engineer', currentCompany: 'Kaffa Cloud', experienceYears: 7, currency: CURRENCY, salaryExpectationMin: 780000, salaryExpectationMax: 1080000, status: 'MATCHED', noticePeriodDays: 30, availability: 'ONE_MONTH', source: 'LinkedIn' },
      { resumeParsedData: { interests: ['collaborative', 'patient-first'] }, firstName: 'Eyerusalem', lastName: 'Girma', email: 'eyerusalem@example.com', phone: '+251-911-450-105', location: { city: 'Hawassa', country: 'Ethiopia' }, currentTitle: 'Product Manager', currentCompany: 'Meskel Analytics', experienceYears: 4, currency: CURRENCY, salaryExpectationMin: 720000, salaryExpectationMax: 1020000, status: 'UNASSIGNED', noticePeriodDays: 30, availability: 'IMMEDIATE', source: 'Referral' },
      { resumeParsedData: { interests: ['fast-paced', 'startup-vibes'] }, firstName: 'Fitsum', lastName: 'Negash', email: 'fitsum@example.com', phone: '+251-911-450-106', location: { city: 'Addis Ababa', country: 'Ethiopia' }, currentTitle: 'Full Stack Engineer', currentCompany: 'Axum Data', experienceYears: 9, currency: CURRENCY, salaryExpectationMin: 1080000, salaryExpectationMax: 1440000, status: 'INTERVIEWING', noticePeriodDays: 14, availability: 'IMMEDIATE', source: 'Direct' },
      { resumeParsedData: { interests: ['innovative', 'collaborative'] }, firstName: 'Genet', lastName: 'Worku', email: 'genet@example.com', phone: '+251-911-450-107', location: { city: 'Bahir Dar', country: 'Ethiopia' }, currentTitle: 'ML Engineer', currentCompany: 'Shola Digital', experienceYears: 5, currency: CURRENCY, salaryExpectationMin: 1020000, salaryExpectationMax: 1320000, status: 'PLACED', noticePeriodDays: 7, availability: 'IMMEDIATE', source: 'LinkedIn' },
      { resumeParsedData: { interests: ['collaborative', 'mission-driven'] }, firstName: 'Henok', lastName: 'Assefa', email: 'henok@example.com', phone: '+251-911-450-108', location: { city: 'Mekelle', country: 'Ethiopia' }, currentTitle: 'UX Designer', currentCompany: 'Simien Studio', experienceYears: 6, currency: CURRENCY, salaryExpectationMin: 600000, salaryExpectationMax: 840000, status: 'OFFERED', noticePeriodDays: 30, availability: 'TWO_WEEKS', source: 'Referral' },
    ]);

    // Skills
    const skillsData = [
      { candidate: candidates[0], skillName: 'React', category: 'Frontend', proficiencyLevel: 5, yearsOfExperience: 5, isPrimary: true },
      { candidate: candidates[0], skillName: 'TypeScript', category: 'Frontend', proficiencyLevel: 4, yearsOfExperience: 4 },
      { candidate: candidates[0], skillName: 'Node.js', category: 'Backend', proficiencyLevel: 3, yearsOfExperience: 3 },
      { candidate: candidates[1], skillName: 'Python', category: 'Backend', proficiencyLevel: 4, yearsOfExperience: 4, isPrimary: true },
      { candidate: candidates[1], skillName: 'Django', category: 'Backend', proficiencyLevel: 4, yearsOfExperience: 3.5 },
      { candidate: candidates[1], skillName: 'PostgreSQL', category: 'Database', proficiencyLevel: 3, yearsOfExperience: 3 },
      { candidate: candidates[2], skillName: 'Python', category: 'Data Science', proficiencyLevel: 5, yearsOfExperience: 5, isPrimary: true },
      { candidate: candidates[2], skillName: 'TensorFlow', category: 'ML', proficiencyLevel: 4, yearsOfExperience: 3 },
      { candidate: candidates[2], skillName: 'SQL', category: 'Database', proficiencyLevel: 4, yearsOfExperience: 4 },
      { candidate: candidates[3], skillName: 'AWS', category: 'DevOps', proficiencyLevel: 5, yearsOfExperience: 5, isPrimary: true },
      { candidate: candidates[3], skillName: 'Kubernetes', category: 'DevOps', proficiencyLevel: 4, yearsOfExperience: 3 },
      { candidate: candidates[3], skillName: 'Terraform', category: 'DevOps', proficiencyLevel: 4, yearsOfExperience: 2.5 },
      { candidate: candidates[4], skillName: 'Product Management', category: 'Product', proficiencyLevel: 4, yearsOfExperience: 4, isPrimary: true },
      { candidate: candidates[4], skillName: 'Agile', category: 'Methodology', proficiencyLevel: 4, yearsOfExperience: 3 },
      { candidate: candidates[5], skillName: 'React', category: 'Frontend', proficiencyLevel: 5, yearsOfExperience: 6, isPrimary: true },
      { candidate: candidates[5], skillName: 'Node.js', category: 'Backend', proficiencyLevel: 5, yearsOfExperience: 5 },
      { candidate: candidates[5], skillName: 'Go', category: 'Backend', proficiencyLevel: 3, yearsOfExperience: 2 },
      { candidate: candidates[6], skillName: 'Python', category: 'ML', proficiencyLevel: 5, yearsOfExperience: 4, isPrimary: true },
      { candidate: candidates[6], skillName: 'PyTorch', category: 'ML', proficiencyLevel: 4, yearsOfExperience: 3 },
      { candidate: candidates[6], skillName: 'Amharic NLP', category: 'ML', proficiencyLevel: 4, yearsOfExperience: 2.5 },
      { candidate: candidates[7], skillName: 'Figma', category: 'Design', proficiencyLevel: 5, yearsOfExperience: 5, isPrimary: true },
      { candidate: candidates[7], skillName: 'UI Design', category: 'Design', proficiencyLevel: 4, yearsOfExperience: 4 },
      { candidate: candidates[7], skillName: 'User Research', category: 'Design', proficiencyLevel: 3, yearsOfExperience: 2.5 },
    ];
    for (const s of skillsData) {
      await this.skillRepo.save(this.skillRepo.create(s));
    }

    // Jobs
    const jobs = await this.jobRepo.save([
      { company: companies[0], title: 'Senior Frontend Engineer', slug: 'senior-frontend-engineer-habesha-tech', description: 'Build the interfaces Ethiopian banks and telecom operators put in front of millions of customers.', requirements: ['5+ years React experience', 'Strong TypeScript skills', 'Experience with large-scale applications'], responsibilities: ['Lead frontend architecture', 'Mentor junior developers', 'Work with the design team in Addis Ababa'], requiredSkills: [{ name: 'React', level: 4 }, { name: 'TypeScript', level: 4 }, { name: 'Node.js', level: 3 }], niceToHaveSkills: [{ name: 'Next.js', level: 3 }, { name: 'GraphQL', level: 2 }], location: { city: 'Addis Ababa', country: 'Ethiopia', remote: true }, remotePolicy: 'HYBRID', currency: CURRENCY, salaryMin: 900000, salaryMax: 1260000, employmentType: 'FULL_TIME', visibility: 'PUBLIC', status: 'LIVE', publishedAt: new Date() },
      { company: companies[1], title: 'Backend Developer', slug: 'backend-developer-rift-valley-energy', description: 'Develop the APIs behind our geothermal and solar monitoring platform in the Rift Valley.', requirements: ['4+ years Python experience', 'Experience with Django or FastAPI', 'Database design skills'], responsibilities: ['Design REST APIs', 'Optimise database queries', 'Implement CI/CD pipelines'], requiredSkills: [{ name: 'Python', level: 4 }, { name: 'Django', level: 3 }, { name: 'PostgreSQL', level: 3 }], niceToHaveSkills: [{ name: 'Docker', level: 2 }, { name: 'AWS', level: 2 }], location: { city: 'Adama', country: 'Ethiopia', remote: true }, remotePolicy: 'REMOTE', currency: CURRENCY, salaryMin: 660000, salaryMax: 900000, employmentType: 'FULL_TIME', visibility: 'PUBLIC', status: 'LIVE', publishedAt: new Date() },
      { company: companies[2], title: 'Data Scientist', slug: 'data-scientist-chaka-fintech', description: 'Build fraud detection and credit risk models on Ethiopian mobile money data.', requirements: ['5+ years in data science', 'Strong Python and SQL', 'Experience with financial data'], responsibilities: ['Develop ML models', 'Analyse transaction patterns', 'Build dashboards for the risk team'], requiredSkills: [{ name: 'Python', level: 4 }, { name: 'SQL', level: 4 }, { name: 'TensorFlow', level: 3 }], niceToHaveSkills: [{ name: 'Spark', level: 2 }, { name: 'Kafka', level: 2 }], location: { city: 'Addis Ababa', country: 'Ethiopia', remote: false }, remotePolicy: 'ONSITE', currency: CURRENCY, salaryMin: 840000, salaryMax: 1200000, employmentType: 'FULL_TIME', visibility: 'PUBLIC', status: 'LIVE', publishedAt: new Date() },
      { company: companies[0], title: 'DevOps Engineer', slug: 'devops-engineer-habesha-tech', description: 'Run the cloud and on-premise infrastructure behind our core banking platform.', requirements: ['4+ years DevOps experience', 'Strong AWS knowledge', 'Kubernetes expertise'], responsibilities: ['Manage Kubernetes clusters', 'Build CI/CD pipelines', 'Monitor infrastructure'], requiredSkills: [{ name: 'AWS', level: 4 }, { name: 'Kubernetes', level: 4 }, { name: 'Terraform', level: 3 }], niceToHaveSkills: [{ name: 'Prometheus', level: 2 }, { name: 'GitHub Actions', level: 2 }], location: { city: 'Addis Ababa', country: 'Ethiopia', remote: true }, remotePolicy: 'HYBRID', currency: CURRENCY, salaryMin: 780000, salaryMax: 1080000, employmentType: 'FULL_TIME', visibility: 'PUBLIC', status: 'APPROVED' },
      { company: companies[3], title: 'Product Manager', slug: 'product-manager-tena-health', description: 'Lead the records platform used by regional hospitals and health posts across Amhara.', requirements: ['3+ years product management', 'Healthcare experience preferred', 'Strong analytical skills'], responsibilities: ['Define the product roadmap', 'Work with the engineering team', 'Run field visits with clinic staff'], requiredSkills: [{ name: 'Product Management', level: 3 }, { name: 'Agile', level: 3 }], niceToHaveSkills: [{ name: 'SQL', level: 2 }, { name: 'Data Analysis', level: 2 }], location: { city: 'Bahir Dar', country: 'Ethiopia', remote: false }, remotePolicy: 'ONSITE', currency: CURRENCY, salaryMin: 720000, salaryMax: 1020000, employmentType: 'FULL_TIME', visibility: 'PUBLIC', status: 'PENDING_APPROVAL' },
    ]);

    // Placements
    const placement = await this.placementRepo.save({
      candidate: candidates[6],
      job: jobs[0],
      company: companies[0],
      status: 'ACTIVE',
      startDate: '2026-07-01',
      salaryOffered: 1380000,
      feePercentage: 20,
      placementFee: 276000,
      satisfactionScore: 5,
    });

    // Pipeline stages
    await this.pipelineRepo.save([
      { entityType: 'COMPANY', entityId: companies[0].id, stage: 'ACTIVE', previousStage: 'ONBOARDED', notes: 'Fully onboarded, posting jobs' },
      { entityType: 'COMPANY', entityId: companies[1].id, stage: 'ACTIVE', previousStage: 'ONBOARDED', notes: 'Regular job postings' },
      { entityType: 'COMPANY', entityId: companies[4].id, stage: 'LEAD', notes: 'First meeting held in Hawassa' },
      { entityType: 'CANDIDATE', entityId: candidates[0].id, stage: 'MATCHED', previousStage: 'SCREENING', notes: 'Strong match for the Habesha Tech frontend role' },
      { entityType: 'CANDIDATE', entityId: candidates[1].id, stage: 'SCREENING', previousStage: 'UNASSIGNED', notes: 'Initial screening scheduled' },
      { entityType: 'CANDIDATE', entityId: candidates[2].id, stage: 'SENT_TO_COMPANY', previousStage: 'MATCHED', notes: 'Sent to Chaka Financial Technologies for review' },
      { entityType: 'CANDIDATE', entityId: candidates[5].id, stage: 'INTERVIEWING', previousStage: 'SENT_TO_COMPANY', notes: 'Technical interview completed' },
      { entityType: 'CANDIDATE', entityId: candidates[7].id, stage: 'OFFERED', previousStage: 'INTERVIEWING', notes: 'Offer extended, awaiting response' },
      { entityType: 'PLACEMENT', entityId: placement.id, stage: 'ACTIVE', notes: 'Genet placed at Habesha Tech Group' },
    ]);

    // Client portal accounts. These belong to an employer and can only ever see
    // that employer's roles and the candidates submitted to them.
    const [habeshaTech, , chaka] = companies;
    await this.userRepo.save([
      this.userRepo.create({
        email: 'client@habeshatech.et', passwordHash: hash('client123'), role: 'CLIENT_ADMIN',
        firstName: 'Hanna', lastName: 'Wolde', status: 'ACTIVE', companyId: habeshaTech.id,
      }),
      this.userRepo.create({
        email: 'hiring@habeshatech.et', passwordHash: hash('client123'), role: 'CLIENT_USER',
        firstName: 'Nahom', lastName: 'Mengistu', status: 'ACTIVE', companyId: habeshaTech.id,
      }),
      this.userRepo.create({
        email: 'client@chaka.et', passwordHash: hash('client123'), role: 'CLIENT_ADMIN',
        firstName: 'Rahel', lastName: 'Abera', status: 'ACTIVE', companyId: chaka.id,
      }),
    ]);

    // Candidates already submitted to each client, so both portals open with
    // something to review and the two are visibly separate.
    await this.dispatchRepo.save([
      this.dispatchRepo.create({
        candidate: candidates[0], job: jobs[0], company: habeshaTech,
        status: 'SENT', message: 'Strongest frontend profile in the Addis pool right now.',
        dispatchedBy: recruiter,
      }),
      this.dispatchRepo.create({
        candidate: candidates[5], job: jobs[0], company: habeshaTech,
        status: 'SHORTLISTED', message: 'Nine years full stack, immediately available.',
        clientNote: 'Good fit on paper — keen to meet.',
        viewedAt: new Date(), respondedAt: new Date(), dispatchedBy: recruiter,
      }),
      this.dispatchRepo.create({
        candidate: candidates[3], job: jobs[3], company: habeshaTech,
        status: 'SENT', message: 'Deep AWS and Kubernetes background.',
        dispatchedBy: recruiter,
      }),
      this.dispatchRepo.create({
        candidate: candidates[2], job: jobs[2], company: chaka,
        status: 'SENT', message: 'Has built fraud models on mobile money transaction data.',
        dispatchedBy: recruiter,
      }),
    ]);

    // A candidate sitting in a client's portal has, by definition, been sent to
    // that client — keep the pipeline saying so rather than leaving them at
    // MATCHED, which would block the client's interview request.
    const submitted = await this.dispatchRepo.find({ relations: ['candidate', 'company'] });
    for (const dispatch of submitted) {
      const candidate = dispatch.candidate;
      if (!candidate || !['SCREENING', 'MATCHED'].includes(candidate.status)) continue;
      await this.candidateRepo.update(candidate.id, { status: 'SENT_TO_COMPANY' });
      await this.pipelineRepo.save(
        this.pipelineRepo.create({
          entityType: 'CANDIDATE',
          entityId: candidate.id,
          stage: 'SENT_TO_COMPANY',
          previousStage: candidate.status,
          notes: `Submitted to ${dispatch.company?.name}`,
          changedBy: recruiter,
        }),
      );
    }

    // A candidate login, so the applicant view has something real behind it.
    const abebechLogin = await this.userRepo.save(
      this.userRepo.create({
        email: 'abebech@example.com', passwordHash: hash('candidate123'), role: 'CANDIDATE',
        firstName: 'Abebech', lastName: 'Tesfaye', status: 'ACTIVE',
      }),
    );
    await this.candidateRepo.update(candidates[0].id, { user: abebechLogin });

    // Applications she made herself, at different points in the journey.
    const now = () => new Date().toISOString();
    await this.applicationRepo.save([
      this.applicationRepo.create({
        candidate: candidates[0], job: jobs[0], company: companies[0],
        status: 'SHORTLISTED', source: 'PUBLIC_BOARD',
        coverNote: 'I have led frontend architecture on a banking platform of similar scale.',
        timeline: [
          { status: 'SUBMITTED', note: 'Application received', at: now() },
          { status: 'UNDER_REVIEW', note: 'A recruiter is reviewing your profile', at: now() },
          { status: 'SHORTLISTED', note: 'Your profile was shared with Habesha Tech Group', at: now() },
        ],
      }),
      this.applicationRepo.create({
        candidate: candidates[0], job: jobs[3], company: companies[0],
        status: 'SUBMITTED', source: 'PUBLIC_BOARD',
        coverNote: 'Interested in moving closer to infrastructure work.',
        timeline: [{ status: 'SUBMITTED', note: 'Application received', at: now() }],
      }),
    ]);
  }
}
