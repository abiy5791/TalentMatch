import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { MatchScore } from '../../entities/match-score.entity';
import { Candidate } from '../../entities/candidate.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { Notification } from '../../entities/notification.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { CandidateDispatch } from '../../entities/candidate-dispatch.entity';
import { AppSetting } from '../../entities/app-setting.entity';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatchScore, Candidate, JobPosting, Notification, PipelineStage, CandidateDispatch, AppSetting,
    ]),
    ApplicationsModule,
  ],
  providers: [MatchingService],
  controllers: [MatchingController],
  exports: [MatchingService],
})
export class MatchingModule {}
