import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Candidate } from './candidate.entity';

/**
 * Metadata for one uploaded CV. The bytes live on disk under `id` — never under
 * anything the uploader chose — and this row is the only way to find them.
 *
 * Uploads are append-only: replacing a CV writes a new row and a new file rather
 * than overwriting, so an application always resolves to the document that was
 * actually submitted with it, not whatever the candidate uploaded later.
 */
@Entity('resume_files')
@Index(['claimed', 'expiresAt'])
export class ResumeFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Set once the upload is attached to a profile or an application. */
  @ManyToOne(() => Candidate, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate | null;

  /** The uploader's filename, sanitised. Shown to humans; never used as a path. */
  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  /** Resolved from the file's own bytes, not from what the client claimed. */
  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  /** SHA-256 of the stored bytes — integrity check on the way back out. */
  @Column({ type: 'varchar', length: 64 })
  checksum: string;

  /**
   * False while an anonymous upload is still waiting for the application that
   * will use it. Unclaimed uploads are swept, so a stranger cannot fill the
   * disk by uploading and walking away.
   */
  @Column({ type: 'boolean', default: false })
  claimed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
