import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlacementsService } from './placements.service';
import { PlacementsController } from './placements.controller';
import { Placement } from '../../entities/placement.entity';
import { Candidate } from '../../entities/candidate.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Placement, Candidate, JobPosting, PipelineStage]), ApplicationsModule],
  providers: [PlacementsService],
  controllers: [PlacementsController],
})
export class PlacementsModule {}
