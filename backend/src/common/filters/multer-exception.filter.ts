import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';
import { MAX_RESUME_BYTES } from '../../modules/resumes/resume-storage.service';

const MEGABYTES = MAX_RESUME_BYTES / 1024 / 1024;

/**
 * Multer rejects an oversized or malformed upload by throwing before any
 * handler runs, which would otherwise surface as a 500 and read to the person
 * uploading as "the site is broken". These are all caller mistakes, so they get
 * a 4xx and a sentence explaining what to do.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(error: MulterError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const [status, message] = ((): [number, string] => {
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return [HttpStatus.PAYLOAD_TOO_LARGE, `A CV must be ${MEGABYTES} MB or smaller`];
        case 'LIMIT_FILE_COUNT':
        case 'LIMIT_UNEXPECTED_FILE':
          return [HttpStatus.BAD_REQUEST, 'Attach exactly one file, in the "file" field'];
        case 'LIMIT_PART_COUNT':
        case 'LIMIT_FIELD_COUNT':
        case 'LIMIT_FIELD_KEY':
        case 'LIMIT_FIELD_VALUE':
          return [HttpStatus.BAD_REQUEST, 'That upload had more parts than expected'];
        default:
          return [HttpStatus.BAD_REQUEST, 'That upload could not be read'];
      }
    })();

    response.status(status).json({ statusCode: status, message, error: error.code });
  }
}
