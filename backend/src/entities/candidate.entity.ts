import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { CandidateSkill } from './candidate-skill.entity';
import { ResumeFile } from './resume-file.entity';

@Entity('candidates')
@Index(['status'])
@Index(['assignedRecruiter'])
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ type: 'jsonb', default: {} })
  location: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentTitle: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentCompany: string;

  @Column({ type: 'int', nullable: true })
  experienceYears: number;

  @Column({ type: 'int', nullable: true })
  salaryExpectationMin: number;

  @Column({ type: 'int', nullable: true })
  salaryExpectationMax: number;

  @Column({ type: 'varchar', length: 3, default: 'ETB' })
  currency: string;

  @Column({ type: 'int', nullable: true })
  noticePeriodDays: number;

  @Column({ type: 'varchar', length: 50, default: 'IMMEDIATE' })
  availability: string;

  @Column({ type: 'varchar', length: 50, default: 'UNASSIGNED' })
  status: 'UNASSIGNED' | 'SCREENING' | 'MATCHED' | 'SENT_TO_COMPANY' | 'INTERVIEWING' | 'OFFERED' | 'PLACED' | 'ARCHIVED';

  @Column({ type: 'jsonb', default: {} })
  verifiedFlags: any;

  /** An externally hosted CV, e.g. a link a recruiter pasted in. */
  @Column({ type: 'text', nullable: true })
  resumeUrl: string;

  /**
   * The CV they last uploaded here. Points at the newest file; older ones stay
   * put, because each application keeps the document it was sent with.
   */
  @ManyToOne(() => ResumeFile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resume_file_id' })
  resumeFile: ResumeFile | null;

  @Column({ type: 'jsonb', default: {} })
  resumeParsedData: any;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_recruiter_id' })
  assignedRecruiter: User;

  @OneToMany(() => CandidateSkill, skill => skill.candidate)
  skills: CandidateSkill[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
