import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

@Entity('job_postings')
@Index(['status', 'visibility'])
@Index(['company', 'status'])
export class JobPosting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  requirements: string[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  responsibilities: string[];

  // Stored as a single jsonb array (e.g. [{"name":"React","level":4}]) rather than
  // jsonb[], so it can be expanded with jsonb_array_elements() in analytics queries.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  requiredSkills: { name: string; level: number }[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  niceToHaveSkills: { name: string; level: number }[];

  @Column({ type: 'jsonb', default: {} })
  location: any;

  @Column({ type: 'varchar', length: 50, nullable: true })
  remotePolicy: string;

  @Column({ type: 'int', nullable: true })
  salaryMin: number;

  @Column({ type: 'int', nullable: true })
  salaryMax: number;

  @Column({ type: 'varchar', length: 3, default: 'ETB' })
  currency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  employmentType: string;

  @Column({ type: 'varchar', length: 50, default: 'PUBLIC' })
  visibility: 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';

  /**
   * When set, an application to this role is not accepted without a CV. Off by
   * default: asking for a document is a decision the hiring team makes per
   * role, not a tax on every applicant.
   */
  @Column({ type: 'boolean', default: false })
  requiresResume: boolean;

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'LIVE' | 'PAUSED' | 'CLOSED' | 'FILLED';

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
