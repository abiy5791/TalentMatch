import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CandidatesService } from './candidates.service';
import {
  CreateCandidateDto, UpdateCandidateDto, UpdateStatusDto, VerifyDto, SetSkillsDto,
} from './dto/candidate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

@ApiTags('candidates')
@ApiBearerAuth()
@Controller('candidates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CandidatesController {
  constructor(private service: CandidatesService) {}

  @Get()
  @RequirePermissions(P.CANDIDATES_READ)
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  @RequirePermissions(P.CANDIDATES_READ)
  findById(@Param('id', ParseUUIDPipe) id: string) { return this.service.findById(id); }

  @Post()
  @RequirePermissions(P.CANDIDATES_WRITE)
  create(@Body() dto: CreateCandidateDto) { return this.service.create(dto); }

  @Post('bulk')
  @RequirePermissions(P.CANDIDATES_WRITE)
  bulk(@Body() body: { candidates: CreateCandidateDto[] }) {
    return Promise.all(body.candidates.map(c => this.service.create(c)));
  }

  @Put(':id')
  @RequirePermissions(P.CANDIDATES_WRITE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCandidateDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(P.CANDIDATES_WRITE)
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto, @Req() req: any) {
    return this.service.updateStatus(id, dto.status, dto.notes, req.user?.sub);
  }

  @Patch(':id/skills')
  @RequirePermissions(P.CANDIDATES_WRITE)
  setSkills(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetSkillsDto) {
    return this.service.setSkills(id, dto.skills);
  }

  // Verification is a sign-off on background/reference checks, so it sits with
  // managers rather than the recruiter who sourced the candidate.
  @Patch(':id/verify')
  @RequirePermissions(P.CANDIDATES_VERIFY)
  verify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyDto, @Req() req: any) {
    return this.service.setVerification(id, dto.flags, req.user?.sub);
  }

  @Delete(':id')
  @RequirePermissions(P.CANDIDATES_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
