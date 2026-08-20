import {
  BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap,
  PayloadTooLargeException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ResumeFile } from '../../entities/resume-file.entity';

/** 5 MB. A CV that does not fit in this is not a CV. */
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** Unclaimed anonymous uploads are swept after this long. */
const UNCLAIMED_TTL_MS = 2 * 60 * 60 * 1000;

const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

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

  constructor(@InjectRepository(ResumeFile) private repo: Repository<ResumeFile>) {
    // Deliberately outside anything the app serves statically — the only route
    // to these bytes is the guarded download endpoint.
    this.root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'resumes'));
  }

  async onApplicationBootstrap() {
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
    });
    const saved = await this.repo.save(record);

    try {
      // wx: never overwrite. The id is fresh, so a collision means something is
      // badly wrong and silently clobbering somebody's CV is the worst response.
      await fs.writeFile(this.pathFor(saved.id), file.buffer, { flag: 'wx', mode: 0o600 });
    } catch (e) {
      await this.repo.delete(saved.id);
      throw e;
    }
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
    try {
      buffer = await fs.readFile(this.pathFor(record.id));
    } catch {
      throw new NotFoundException('That CV is no longer stored');
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

  /**
   * Two jobs, both about not accumulating other people's files: drop uploads
   * nobody ever attached to an application, and drop files whose row has gone
   * (a deleted candidate cascades the row away but not the bytes).
   */
  private async sweep() {
    const expired = await this.repo.find({
      where: { claimed: false, expiresAt: LessThan(new Date()) },
    });
    for (const record of expired) {
      await fs.rm(this.pathFor(record.id), { force: true });
      await this.repo.delete(record.id);
    }

    const onDisk = await fs.readdir(this.root).catch(() => [] as string[]);
    const grace = Date.now() - UNCLAIMED_TTL_MS;
    let orphans = 0;
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

    if (expired.length || orphans) {
      this.logger.log(`Swept ${expired.length} unclaimed upload(s) and ${orphans} orphaned file(s)`);
    }
  }
}
