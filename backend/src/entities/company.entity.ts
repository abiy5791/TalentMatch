import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('companies')
@Index(['tier', 'status'])
@Index(['status'])
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  slug: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  industry: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  size: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';

  @Column({ type: 'jsonb', default: {} })
  location: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  cultureTags: string[];

  @Column({ type: 'text', nullable: true })
  logoUrl: string;

  @Column({ type: 'text', nullable: true })
  bannerUrl: string;

  @Column({ type: 'varchar', length: 50, default: 'STANDARD' })
  tier: 'STANDARD' | 'VIP' | 'RETAINER';

  @Column({ type: 'varchar', length: 50, default: 'LEAD' })
  status: 'LEAD' | 'ONBOARDED' | 'ACTIVE' | 'FULFILLED' | 'INACTIVE';

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'account_manager_id' })
  accountManager: User;

  @Column({ type: 'timestamptz', nullable: true })
  onboardingCompletedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
