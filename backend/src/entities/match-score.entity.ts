import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Candidate } from './candidate.entity';
import { JobPosting } from './job-posting.entity';
import { numericTransformer } from '../database/snake-naming.strategy';

@Entity('match_scores')
@Index(['job', 'overallScore'])
@Index(['candidate', 'overallScore'])
@Unique(['candidate', 'job'])
export class MatchScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @ManyToOne(() => JobPosting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: JobPosting;

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: numericTransformer })
  overallScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  skillMatchScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  locationMatchScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  salaryMatchScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  experienceMatchScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  cultureMatchScore: number;

  @Column({ type: 'jsonb', default: {} })
  factorBreakdown: any;

  @Column({ type: 'varchar', length: 20, nullable: true })
  algorithmVersion: string;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  calculatedAt: Date;
}
