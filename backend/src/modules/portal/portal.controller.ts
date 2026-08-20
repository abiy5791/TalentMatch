import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortalService } from './portal.service';
import {
  PortalFeedbackDto, RequestRoleDto, RespondDto, InviteColleagueDto, TeamStatusDto, TeamRoleDto,
} from './dto/portal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ClientScopeGuard } from './guards/client-scope.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

/**
 * The employer-facing surface. Every handler takes its company from
 * `req.companyScope`, set by ClientScopeGuard from the signed token — no route
 * or query parameter can widen it.
 */
@ApiTags('portal')
@ApiBearerAuth()
@Controller('portal')
@UseGuards(JwtAuthGuard, PermissionsGuard, ClientScopeGuard)
@RequirePermissions(P.PORTAL_ACCESS)
export class PortalController {
  constructor(private service: PortalService) {}

  @Get('company')
  company(@Req() req: any) { return this.service.getCompany(req.companyScope); }

  @Get('overview')
  overview(@Req() req: any) { return this.service.getOverview(req.companyScope); }

  @Get('jobs')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_JOBS_READ)
  jobs(@Req() req: any, @Query() query: any) {
    return this.service.getJobs(req.companyScope, query);
  }

  @Post('jobs/request')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_JOBS_REQUEST)
  requestRole(@Req() req: any, @Body() dto: RequestRoleDto) {
    return this.service.requestRole(req.companyScope, dto, req.user.sub);
  }

  @Get('candidates')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_CANDIDATES_READ)
  candidates(@Req() req: any, @Query() query: any) {
    return this.service.getSubmittedCandidates(req.companyScope, query);
  }

  @Get('candidates/:id')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_CANDIDATES_READ)
  submission(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSubmission(req.companyScope, id);
  }

  @Patch('candidates/:id/respond')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_CANDIDATES_RESPOND)
  respond(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondDto) {
    return this.service.respond(req.companyScope, id, dto, req.user.sub);
  }

  /* ---- Team (account owner only) ---- */

  @Get('team')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_TEAM_READ)
  team(@Req() req: any) { return this.service.getTeam(req.companyScope); }

  @Post('team')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_TEAM_MANAGE)
  invite(@Req() req: any, @Body() dto: InviteColleagueDto) {
    return this.service.inviteTeamMember(req.companyScope, dto);
  }

  @Patch('team/:id/status')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_TEAM_MANAGE)
  setStatus(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamStatusDto) {
    return this.service.setTeamMemberStatus(req.companyScope, id, dto.status, req.user.sub);
  }

  @Patch('team/:id/role')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_TEAM_MANAGE)
  setRole(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TeamRoleDto) {
    return this.service.setTeamMemberRole(req.companyScope, id, dto.role, req.user.sub);
  }

  @Get('placements')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_PLACEMENTS_READ)
  placements(@Req() req: any) { return this.service.getPlacements(req.companyScope); }

  @Patch('placements/:id/feedback')
  @RequirePermissions(P.PORTAL_ACCESS, P.PORTAL_FEEDBACK_WRITE)
  feedback(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PortalFeedbackDto) {
    return this.service.leaveFeedback(req.companyScope, id, dto);
  }
}
