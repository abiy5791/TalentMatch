import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { Candidate } from './candidate.entity';
import { JobPosting } from './job-posting.entity';
import { Company } from './company.entity';
import { ResumeFile } from './resume-file.entity';

/**
 * The candidate-facing stages. Deliberately coarser than the internal pipeline:
 * an applicant should know where they stand without seeing how the sausage is
 * made (match scores, which client was pitched, recruiter notes).
 */
export type ApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEWING'
  | 'OFFERED'
  | 'HIRED'
  | 'NOT_PROGRESSING'
  | 'WITHDRAWN';

/** Someone applying to a job themselves, as opposed to being sourced. */
@Entity('applications')
@Index(['candidate', 'status'])
@Index(['job', 'status'])
@Unique(['candidate', 'job'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @ManyToOne(() => JobPosting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobPosting;

  /** Denormalised from the job so the console can filter by client cheaply. */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar', length: 50, default: 'SUBMITTED' })
  status: ApplicationStatus;

  @Column({ type: 'text', nullable: true })
  coverNote: string;

  /**
   * The CV submitted with this application, frozen at the moment it was sent.
   * A recruiter opening a six-month-old application reads what the applicant
   * actually gave them, not whatever they have uploaded since.
   */
  @ManyToOne(() => ResumeFile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resume_file_id' })
  resumeFile: ResumeFile | null;

  /** Where the application came from — the public board, or a recruiter. */
  @Column({ type: 'varchar', length: 50, default: 'PUBLIC_BOARD' })
  source: string;

  /**
   * Plain-language history the applicant sees, e.g.
   * [{ status, note, at }]. Internal pipeline detail never appears here.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  timeline: { status: string; note?: string; at: string }[];

  @Column({ type: 'timestamptz', nullable: true })
  withdrawnAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
