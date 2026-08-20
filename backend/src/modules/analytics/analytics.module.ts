import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Candidate } from '../../entities/candidate.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { Placement } from '../../entities/placement.entity';
import { Company } from '../../entities/company.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate, JobPosting, Placement, Company, PipelineStage])],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
