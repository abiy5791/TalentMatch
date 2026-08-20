import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Candidate } from './candidate.entity';
import { JobPosting } from './job-posting.entity';
import { Company } from './company.entity';
import { numericTransformer } from '../database/snake-naming.strategy';

@Entity('placements')
@Index(['company', 'status'])
export class Placement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Candidate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @ManyToOne(() => JobPosting, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'job_id' })
  job: JobPosting;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED';

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'int', nullable: true })
  salaryOffered: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  placementFee: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  feePercentage: number;

  @Column({ type: 'jsonb', default: {} })
  clientFeedback: any;

  @Column({ type: 'jsonb', default: {} })
  candidateFeedback: any;

  @Column({ type: 'int', nullable: true })
  satisfactionScore: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
