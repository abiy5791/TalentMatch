import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { BatchDispatchDto, DispatchDto } from './dto/dispatch.dto';
import { UpdateWeightsDto } from './dto/weights.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

@ApiTags('matching')
@ApiBearerAuth()
@Controller('matches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MatchingController {
  constructor(private service: MatchingService) {}

  @Get()
  @RequirePermissions(P.MATCHING_READ)
  getAll(@Query() query: any) { return this.service.getAll(query); }

  // Declared before ':id' style routes so the literal path wins.
  /** Anyone who can read matches may see how a score is composed. */
  @Get('weights')
  @RequirePermissions(P.MATCHING_READ)
  getWeights() { return this.service.getWeights(); }

  @Put('weights')
  @RequirePermissions(P.MATCHING_CONFIGURE)
  updateWeights(@Body() dto: UpdateWeightsDto, @Req() req: any) {
    return this.service.updateWeights(dto, req.user?.sub);
  }

  @Delete('weights')
  @RequirePermissions(P.MATCHING_CONFIGURE)
  resetWeights() { return this.service.resetWeights(); }

  @Get('dispatches')
  @RequirePermissions(P.MATCHING_READ)
  getDispatches(@Query() query: any) { return this.service.getDispatches(query); }

  @Get('job/:id')
  @RequirePermissions(P.MATCHING_READ)
  getForJob(@Param('id', ParseUUIDPipe) id: string) { return this.service.findMatchesForJob(id); }

  @Get('candidate/:id')
  @RequirePermissions(P.MATCHING_READ)
  getForCandidate(@Param('id', ParseUUIDPipe) id: string) { return this.service.findMatchesForCandidate(id); }

  @Post('calculate')
  @RequirePermissions(P.MATCHING_CALCULATE)
  calcAll() { return this.service.calculateAll(); }

  @Post('calculate/job/:id')
  @RequirePermissions(P.MATCHING_CALCULATE)
  calcForJob(@Param('id', ParseUUIDPipe) id: string) { return this.service.calculateForJob(id); }

  @Post('calculate/candidate/:id')
  @RequirePermissions(P.MATCHING_CALCULATE)
  calcForCandidate(@Param('id', ParseUUIDPipe) id: string) { return this.service.calculateForCandidate(id); }

  @Post('dispatch')
  @RequirePermissions(P.MATCHING_DISPATCH)
  dispatch(@Body() dto: DispatchDto, @Req() req: any) {
    return this.service.dispatch(dto, req.user?.sub);
  }

  @Post('batch-dispatch')
  @RequirePermissions(P.MATCHING_DISPATCH)
  batchDispatch(@Body() dto: BatchDispatchDto, @Req() req: any) {
    return this.service.batchDispatch(dto.jobId, dto.topN ?? 5, dto.message, req.user?.sub);
  }
}
