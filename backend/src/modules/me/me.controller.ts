import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Req, UploadedFile, UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MeService } from './me.service';
import { ApplyAsCandidateDto, UpdateMyProfileDto, WithdrawDto } from './dto/me.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CandidateScopeGuard } from './guards/candidate-scope.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RateLimitGuard, Throttle } from '../../common/guards/rate-limit.guard';
import { RESUME_BODY_SCHEMA, RESUME_UPLOAD } from '../resumes/resumes.controller';
import { PERMISSIONS as P } from '../auth/permissions';

/**
 * Candidate self-service. Every handler works from `req.candidateScope`, which
 * CandidateScopeGuard derives from the token — an applicant can only ever reach
 * their own profile and applications.
 */
@ApiTags('candidate')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard, PermissionsGuard, CandidateScopeGuard, RateLimitGuard)
@RequirePermissions(P.ME_ACCESS)
export class MeController {
  constructor(private service: MeService) {}

  @Get('summary')
  summary(@Req() req: any) { return this.service.getSummary(req.candidateScope); }

  @Get('profile')
  @RequirePermissions(P.ME_ACCESS, P.ME_PROFILE_READ)
  profile(@Req() req: any) { return this.service.getProfile(req.candidateScope); }

  @Put('profile')
  @RequirePermissions(P.ME_ACCESS, P.ME_PROFILE_WRITE)
  updateProfile(@Req() req: any, @Body() dto: UpdateMyProfileDto) {
    return this.service.updateProfile(req.candidateScope, dto);
  }

  /**
   * Replace the CV on file. Throttled even though the caller is known — an
   * account is not a licence to fill the disk.
   */
  @Post('resume')
  @RequirePermissions(P.ME_ACCESS, P.ME_PROFILE_WRITE)
  @Throttle(10, 15 * 60)
  @ApiConsumes('multipart/form-data')
  @ApiBody(RESUME_BODY_SCHEMA)
  @UseInterceptors(FileInterceptor('file', RESUME_UPLOAD))
  uploadResume(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.service.replaceResume(req.candidateScope, file);
  }

  @Get('applications')
  @RequirePermissions(P.ME_ACCESS, P.ME_APPLICATIONS_READ)
  applications(@Req() req: any) { return this.service.getApplications(req.candidateScope); }

  /** Apply without retyping what the profile already holds. */
  @Post('applications')
  @RequirePermissions(P.ME_ACCESS, P.ME_APPLICATIONS_APPLY)
  @Throttle(20, 60 * 60)
  apply(@Req() req: any, @Body() dto: ApplyAsCandidateDto) {
    return this.service.apply(req.candidateScope, dto);
  }

  @Get('applications/:id')
  @RequirePermissions(P.ME_ACCESS, P.ME_APPLICATIONS_READ)
  application(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getApplication(req.candidateScope, id);
  }

  @Patch('applications/:id/withdraw')
  @RequirePermissions(P.ME_ACCESS, P.ME_APPLICATIONS_WITHDRAW)
  withdraw(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WithdrawDto) {
    return this.service.withdraw(req.candidateScope, id, dto.reason);
  }
}
