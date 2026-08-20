import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('users')
@Index(['email'])
@Index(['role'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 50 })
  role: 'SUPER_ADMIN' | 'MANAGER' | 'RECRUITER' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'CANDIDATE';

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';

  /**
   * The employer a client-portal account belongs to. Null for internal staff.
   * Held as a plain id rather than a relation to keep users <-> companies from
   * importing each other in a cycle; the portal resolves the company itself.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
