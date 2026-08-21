import {
  BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap,
  PayloadTooLargeException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ResumeFile } from '../../entities/resume-file.entity';
import { IS_SERVERLESS } from '../../database/data-source-options';

/**
 * The size ceiling for one CV. 5 MB: a CV that does not fit in this is not a CV.
 *
 * Lower under serverless, because the platform caps a request body below that
 * anyway — Vercel rejects anything over 4.5 MB before the function is invoked,
 * which reaches an applicant as a dead upload rather than a message they can
 * act on. Better to state a limit we can enforce and explain. Override with
 * MAX_RESUME_MB.
 */
export const MAX_RESUME_BYTES = Math.round(
  parseFloat(process.env.MAX_RESUME_MB || (IS_SERVERLESS ? '4' : '5')) * 1024 * 1024,
);

/** Unclaimed anonymous uploads are swept after this long. */
const UNCLAIMED_TTL_MS = 2 * 60 * 60 * 1000;

const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Where the bytes go.
 *
 * `fs` writes to a directory — right for the container deployment, which has a
 * volume behind it. `db` puts them in the row — right for serverless, where the
 * only writable path is a /tmp that is discarded with the instance, so an
 * upload written there is lost minutes later. The driver is the single switch;
 * nothing above this service knows which one is in use.
 */
export type StorageDriver = 'fs' | 'db';

/**
 * The only formats accepted, each pinned to the bytes a real file of that type
 * starts with. A declared content type is a claim by the client; the signature
 * is evidence, and the two have to agree before anything is written.
 */
const ACCEPTED = [
  {
    mimeType: 'application/pdf',
    extensions: ['.pdf'],
    label: 'PDF',
    // "%PDF-"
    signatures: [[0x25, 0x50, 0x44, 0x46, 0x2d]],
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
    label: 'Word (.docx)',
    // A .docx is a zip: "PK\x03\x04", or the empty/spanned variants.
    signatures: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
      [0x50, 0x4b, 0x07, 0x08],
    ],
  },
  {
    mimeType: 'application/msword',
    extensions: ['.doc'],
    label: 'Word (.doc)',
    // OLE2 compound document.
    signatures: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  },
] as const;

export const ACCEPTED_MIME_TYPES = ACCEPTED.map(a => a.mimeType);
export const ACCEPTED_EXTENSIONS = ACCEPTED.flatMap(a => [...a.extensions]);
const ACCEPTED_LABELS = ACCEPTED.map(a => a.label).join(', ');

const startsWith = (buffer: Buffer, signature: readonly number[]) =>
  buffer.length >= signature.length && signature.every((byte, i) => buffer[i] === byte);

/**
 * Reduces an uploader's filename to something safe to store and echo back.
 * Only ever used for display and for the download header — the file on disk is
 * named after its row id, so nothing here can influence a path.
 */
function sanitiseName(raw: string | undefined, fallbackExt: string): string {
  const base = path
    .basename(raw || '')
    // Control characters (which would let a name inject a response header)
    // and the separators a filesystem reads as structure. Everything else
    // survives, so a name in a non-Latin script reaches the recruiter intact.
    .replace(/[\u0000-\u001F\u007F<>:"|?*\\\/]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || base === '.' || base === '..') return `resume${fallbackExt}`;
  return base.length > 120 ? base.slice(0, 120 - fallbackExt.length) + fallbackExt : base;
}

@Injectable()
export class ResumeStorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ResumeStorageService.name);
  private readonly root: string;
  private readonly driver: StorageDriver;
  /** Serverless has no timer to sweep on, so writes carry the cost occasionally. */
  private lastSweep = 0;

  constructor(@InjectRepository(ResumeFile) private repo: Repository<ResumeFile>) {
    const configured = process.env.RESUME_STORAGE as StorageDriver | undefined;
    if (configured && configured !== 'fs' && configured !== 'db') {
      throw new Error(`RESUME_STORAGE must be "fs" or "db", got "${configured}"`);
    }
    // A serverless deployment that quietly chose `fs` would accept every upload
    // and lose it, so the default follows the platform rather than the other way.
    this.driver = configured || (IS_SERVERLESS ? 'db' : 'fs');
    // Deliberately outside anything the app serves statically — the only route
    // to these bytes is the guarded download endpoint.
    this.root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'resumes'));
  }

  async onApplicationBootstrap() {
    if (this.driver === 'db') {
      this.logger.log('Resume storage in database (resume_files.data)');
      return;
    }
    await fs.mkdir(this.root, { recursive: true });
    this.logger.log(`Resume storage at ${this.root}`);
    // Unref'd: a pending sweep must never hold the process open on shutdown.
    setInterval(() => this.sweep().catch(e => this.logger.warn(`Sweep failed: ${e.message}`)), SWEEP_INTERVAL_MS)
      .unref();
    await this.sweep().catch(e => this.logger.warn(`Sweep failed: ${e.message}`));
  }

  /**
   * Validate an upload and write it.
   *
   * Three things have to agree before a byte is written: the extension the
   * uploader used, the content type their browser sent, and the file's own
   * signature. Any disagreement is a rejection — a .pdf that opens with a zip
   * header is not a CV somebody named badly.
   */
  async store(
    file: Express.Multer.File | undefined,
    owner: { candidateId?: string } = {},
  ): Promise<ResumeFile> {
    if (!file) throw new BadRequestException('No file was uploaded');
    if (!file.buffer?.length) throw new BadRequestException('The uploaded file is empty');
    if (file.size > MAX_RESUME_BYTES) {
      throw new PayloadTooLargeException(`A CV must be ${MAX_RESUME_BYTES / 1024 / 1024} MB or smaller`);
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    const declared = (file.mimetype || '').split(';')[0].trim().toLowerCase();

    const byExtension = ACCEPTED.find(a => (a.extensions as readonly string[]).includes(extension));
    if (!byExtension) {
      throw new UnsupportedMediaTypeException(
        `Upload your CV as ${ACCEPTED_LABELS}. That file is a ${extension || 'unknown'} file.`,
      );
    }
    if (declared !== byExtension.mimeType) {
      throw new UnsupportedMediaTypeException(
        `That file says it is a ${declared || 'unknown type'} but is named ${extension}. Re-save it and try again.`,
      );
    }
    if (!byExtension.signatures.some(signature => startsWith(file.buffer, signature))) {
      throw new UnsupportedMediaTypeException(
        `That file is not a readable ${byExtension.label}. Re-export it from your editor and try again.`,
      );
    }

    const record = this.repo.create({
      originalName: sanitiseName(file.originalname, extension),
      // Taken from the matched signature, not from the client's header.
      mimeType: byExtension.mimeType,
      sizeBytes: file.size,
      checksum: createHash('sha256').update(file.buffer).digest('hex'),
      candidate: owner.candidateId ? ({ id: owner.candidateId } as any) : null,
      claimed: Boolean(owner.candidateId),
      expiresAt: owner.candidateId ? null : new Date(Date.now() + UNCLAIMED_TTL_MS),
      // Under `db` the bytes are part of the row, so the insert is atomic and
      // the half-written state the `fs` branch has to undo cannot arise.
      data: this.driver === 'db' ? file.buffer : null,
    });
    const saved = await this.repo.save(record);

    if (this.driver === 'fs') {
      try {
        // wx: never overwrite. The id is fresh, so a collision means something is
        // badly wrong and silently clobbering somebody's CV is the worst response.
        await fs.writeFile(this.pathFor(saved.id), file.buffer, { flag: 'wx', mode: 0o600 });
      } catch (e) {
        await this.repo.delete(saved.id);
        throw e;
      }
    }

    // Nothing ticks between requests in a serverless instance, so the
    // housekeeping a timer would have done rides along with the writes. Not
    // awaited: an applicant's upload should not wait on tidying up after others.
    this.maybeSweep();

    // The buffer was only needed for the insert. Drop it before the row is
    // returned, so no response serialiser upstream can reach the bytes.
    delete (saved as Partial<ResumeFile>).data;
    return saved;
  }

  /** Attach an anonymous upload to the candidate it was submitted for. */
  async claim(resumeId: string, candidateId: string): Promise<ResumeFile> {
    const record = await this.repo.findOne({ where: { id: resumeId }, relations: ['candidate'] });
    if (!record) throw new BadRequestException('That CV upload has expired — please attach it again');
    // An upload already belonging to someone else is not offered a second owner.
    if (record.candidate && record.candidate.id !== candidateId) {
      throw new BadRequestException('That CV upload is not available');
    }
    await this.repo.update(resumeId, {
      candidate: { id: candidateId } as any,
      claimed: true,
      expiresAt: null,
    });
    return this.repo.findOne({ where: { id: resumeId } });
  }

  async findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['candidate'] });
  }

  /**
   * Read the bytes back, verifying they are the ones we wrote. A checksum
   * mismatch means the file was changed underneath us, which is a failure, not
   * something to hand to a browser.
   */
  async read(record: ResumeFile): Promise<Buffer> {
    let buffer: Buffer;
    if (this.driver === 'db') {
      // `data` is select:false, so it has to be asked for by name.
      const row = await this.repo.findOne({
        where: { id: record.id },
        select: { id: true, data: true } as any,
      });
      if (!row?.data?.length) throw new NotFoundException('That CV is no longer stored');
      buffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    } else {
      try {
        buffer = await fs.readFile(this.pathFor(record.id));
      } catch {
        throw new NotFoundException('That CV is no longer stored');
      }
    }
    if (createHash('sha256').update(buffer).digest('hex') !== record.checksum) {
      this.logger.error(`Checksum mismatch reading resume ${record.id}`);
      throw new NotFoundException('That CV could not be read');
    }
    return buffer;
  }

  /**
   * Resolve a storage path from a row id and prove it stayed inside the root.
   * The id is a validated UUID by the time it reaches here, so this is a belt
   * on top of braces — but path containment is exactly the check worth
   * duplicating.
   */
  private pathFor(id: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid file reference');
    }
    const resolved = path.resolve(this.root, `${id}.bin`);
    if (resolved !== path.join(this.root, `${id}.bin`)) {
      throw new BadRequestException('Invalid file reference');
    }
    return resolved;
  }

  /** Holds the piggybacked sweep to the same interval the timer would have used. */
  private maybeSweep() {
    const now = Date.now();
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    this.sweep().catch(e => this.logger.warn(`Sweep failed: ${e.message}`));
  }

  /**
   * Two jobs, both about not accumulating other people's files: drop uploads
   * nobody ever attached to an application, and drop files whose row has gone
   * (a deleted candidate cascades the row away but not the bytes).
   *
   * Only the first applies under `db`: there the bytes are a column, so deleting
   * the row takes them with it and an orphan is not a state the data can reach.
   */
  private async sweep() {
    const expired = await this.repo.find({
      where: { claimed: false, expiresAt: LessThan(new Date()) },
    });
    for (const record of expired) {
      if (this.driver === 'fs') await fs.rm(this.pathFor(record.id), { force: true });
      await this.repo.delete(record.id);
    }

    let orphans = 0;
    if (this.driver === 'fs') {
      const onDisk = await fs.readdir(this.root).catch(() => [] as string[]);
      const grace = Date.now() - UNCLAIMED_TTL_MS;
      for (const name of onDisk) {
        if (!name.endsWith('.bin')) continue;
        const id = name.slice(0, -4);
        const full = path.join(this.root, name);
        // Skip anything written recently, so a file mid-upload is never removed.
        const stat = await fs.stat(full).catch(() => null);
        if (!stat || stat.mtimeMs > grace) continue;
        if (await this.repo.findOne({ where: { id } })) continue;
        await fs.rm(full, { force: true });
        orphans += 1;
      }
    }

    if (expired.length || orphans) {
      this.logger.log(`Swept ${expired.length} unclaimed upload(s) and ${orphans} orphaned file(s)`);
    }
  }
}
