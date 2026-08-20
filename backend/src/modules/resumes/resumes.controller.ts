import {
  Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import {
  ACCEPTED_EXTENSIONS, MAX_RESUME_BYTES, ResumeStorageService,
} from './resume-storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard, Throttle } from '../../common/guards/rate-limit.guard';
import { hasPermission, isCandidateRole, PERMISSIONS as P } from '../auth/permissions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../../entities/candidate.entity';

/**
 * Multer options shared by both upload routes.
 *
 * Memory storage on purpose: nothing a stranger sends touches the disk until it
 * has been checked. The limits are the first line — the service re-checks the
 * size and reads the file's signature before writing.
 */
export const RESUME_UPLOAD = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_BYTES,
    files: 1,
    fields: 4,
    parts: 6,
  },
};

export const RESUME_BODY_SCHEMA = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: `CV as ${ACCEPTED_EXTENSIONS.join(', ')}, up to ${MAX_RESUME_BYTES / 1024 / 1024} MB`,
      },
    },
  },
};

@ApiTags('resumes')
@Controller('resumes')
export class ResumesController {
  constructor(
    private storage: ResumeStorageService,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
  ) {}

  /**
   * Download a CV.
   *
   * Two callers are allowed: the recruiting team, and the person whose CV it is.
   * Employers are not on that list — the portal shows what was formally
   * submitted about a candidate, and a CV is not part of it.
   */
  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const record = await this.storage.findById(id);
    if (!record) throw new NotFoundException('That CV is not available');

    const staff = hasPermission(req.user?.role, P.CANDIDATES_READ);
    let owner = false;
    if (!staff && isCandidateRole(req.user?.role)) {
      const mine = await this.candidateRepo.findOne({ where: { user: { id: req.user.sub } } });
      owner = Boolean(mine && record.candidate?.id === mine.id);
    }
    // Same answer either way: a CV you may not read is one that does not exist.
    if (!staff && !owner) throw new NotFoundException('That CV is not available');

    const body = await this.storage.read(record);

    // Always a download, never rendered in this origin. A PDF viewer running
    // in-page is a scripting surface, and no recruiter needs it to read a CV.
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Length', String(body.length));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${record.originalName.replace(/"/g, '')}"; ` +
        `filename*=UTF-8''${encodeURIComponent(record.originalName)}`,
    );
    // Personal data: never let a shared cache keep a copy.
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(body);
  }
}

/**
 * The one place a stranger can put a file on our disk.
 *
 * Lives under /public so that is unmistakable at the routing table, and is
 * rate-limited per address because it is the only unauthenticated write in the
 * API that consumes storage.
 */
@ApiTags('public')
@Controller('public/resumes')
@UseGuards(RateLimitGuard)
export class PublicResumesController {
  constructor(private storage: ResumeStorageService) {}

  @Post()
  @Throttle(5, 15 * 60)
  @ApiConsumes('multipart/form-data')
  @ApiBody(RESUME_BODY_SCHEMA)
  @UseInterceptors(FileInterceptor('file', RESUME_UPLOAD))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const stored = await this.storage.store(file);
    // The id is the applicant's receipt: they hand it back with the application
    // form, and it is worthless until then.
    return {
      id: stored.id,
      fileName: stored.originalName,
      sizeBytes: stored.sizeBytes,
      mimeType: stored.mimeType,
      expiresAt: stored.expiresAt,
    };
  }
}
