import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../../../entities/candidate.entity';
import { isCandidateRole } from '../../auth/permissions';

/**
 * Resolves the candidate record behind a signed-in applicant and writes it to
 * `request.candidateScope`.
 *
 * Same principle as the client portal: the id is derived from the token, never
 * from the request, so there is no id an applicant could substitute to read
 * somebody else's application.
 */
@Injectable()
export class CandidateScopeGuard implements CanActivate {
  constructor(@InjectRepository(Candidate) private candidateRepo: Repository<Candidate>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !isCandidateRole(user.role)) {
      throw new ForbiddenException('This area is for candidate accounts only');
    }

    const candidate = await this.candidateRepo.findOne({ where: { user: { id: user.sub } } });
    if (!candidate) {
      throw new ForbiddenException(
        'This login is not linked to a candidate profile. Contact the recruitment team.',
      );
    }

    request.candidateScope = candidate.id;
    return true;
  }
}
