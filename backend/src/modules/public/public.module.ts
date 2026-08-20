import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { JobPosting } from '../../entities/job-posting.entity';
import { Candidate } from '../../entities/candidate.entity';
import { CandidateSkill } from '../../entities/candidate-skill.entity';
import { Application } from '../../entities/application.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { ResumesModule } from '../resumes/resumes.module';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobPosting, Candidate, CandidateSkill, Application, PipelineStage, Notification, User,
    ]),
    ResumesModule,
  ],
  providers: [PublicService, RateLimitGuard],
  controllers: [PublicController],
})
export class PublicModule {}
