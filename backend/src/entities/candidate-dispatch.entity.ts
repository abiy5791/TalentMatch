import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { Candidate } from './candidate.entity';
import { JobPosting } from './job-posting.entity';
import { Company } from './company.entity';
import { User } from './user.entity';

export type DispatchStatus =
  | 'SENT'
  | 'VIEWED'
  | 'SHORTLISTED'
  | 'INTERVIEW_REQUESTED'
  | 'DECLINED';

/**
 * A candidate formally put in front of a client for a specific role.
 *
 * This is the record the client portal reads: it is the only thing that makes a
 * candidate visible to a company, and it carries the client's response back to
 * the recruiting team (plan §6.4, "delivery tracking and read receipts").
 */
@Entity('candidate_dispatches')
@Index(['company', 'status'])
@Index(['job', 'status'])
@Unique(['candidate', 'job'])
export class CandidateDispatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @ManyToOne(() => JobPosting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobPosting;

  /** Denormalised from the job so portal queries can scope without a join. */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar', length: 50, default: 'SENT' })
  status: DispatchStatus;

  @Column({ type: 'text', nullable: true })
  message: string;

  /** The client's reason for shortlisting or declining. */
  @Column({ type: 'text', nullable: true })
  clientNote: string;

  @Column({ type: 'timestamptz', nullable: true })
  viewedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'dispatched_by' })
  dispatchedBy: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'responded_by' })
  respondedBy: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
