import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(P.ANALYTICS_READ)
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get('dashboard')
  dashboard() { return this.service.getDashboardMetrics(); }

  @Get('pipeline')
  pipeline() { return this.service.getPipelineSummary(); }

  @Get('gap-analysis')
  gapAnalysis() { return this.service.getGapAnalysis(); }

  @Get('tier-distribution')
  tierDistribution() { return this.service.getCompanyTierDistribution(); }

  /** Success rate is operational; fee totals are withheld without financials. */
  @Get('placements')
  placements(@Req() req: any) { return this.service.getPlacementMetrics(req.user?.role); }

  @Get('time-to-fill')
  timeToFill() { return this.service.getTimeToFill(); }

  @Get('revenue')
  @RequirePermissions(P.ANALYTICS_FINANCIALS)
  revenue() { return this.service.getRevenueBreakdown(); }

  @Get('recent-activity')
  recentActivity(@Query('days') days: string) {
    return this.service.getRecentActivity(days ? parseInt(days, 10) : 7);
  }
}
