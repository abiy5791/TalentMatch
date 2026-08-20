import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service';
import { RateLimitGuard, Throttle } from '../../common/guards/rate-limit.guard';
import { ApplyDto } from './dto/public.dto';

/**
 * The public job board — the only unauthenticated surface in the API.
 *
 * There is no guard here on purpose, so every handler must be read as public.
 * The service decides what is exposed: LIVE + PUBLIC postings only, and a
 * hand-picked set of fields.
 */
@ApiTags('public')
@Controller('public')
@UseGuards(RateLimitGuard)
export class PublicController {
  constructor(private service: PublicService) {}

  @Get('jobs')
  jobs(@Query() query: any) { return this.service.listJobs(query); }

  @Get('jobs/filters')
  filters() { return this.service.getFilters(); }

  @Get('jobs/:slugOrId')
  job(@Param('slugOrId') slugOrId: string) { return this.service.getJob(slugOrId); }

  /**
   * Rate limited by address: this is a write that anyone on the internet can
   * reach, and it creates candidate records.
   */
  @Post('applications')
  @Throttle(10, 60 * 60)
  apply(@Body() dto: ApplyDto) { return this.service.apply(dto); }
}
