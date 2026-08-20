import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('pipeline_stages')
@Index(['entityType', 'entityId', 'createdAt'])
export class PipelineStage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  entityType: 'COMPANY' | 'CANDIDATE' | 'PLACEMENT';

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 100 })
  stage: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  previousStage: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedBy: User;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: any;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
