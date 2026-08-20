import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Candidate } from './candidate.entity';
import { User } from './user.entity';
import { numericTransformer } from '../database/snake-naming.strategy';

@Entity('candidate_skills')
@Index(['candidate'])
@Index(['skillName', 'proficiencyLevel'])
export class CandidateSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Candidate, candidate => candidate.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @Column({ type: 'varchar', length: 100 })
  skillName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'int', nullable: true })
  proficiencyLevel: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, transformer: numericTransformer })
  yearsOfExperience: number;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifiedBy: User;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
