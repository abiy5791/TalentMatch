import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { CandidateScopeGuard } from './guards/candidate-scope.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { ResumesModule } from '../resumes/resumes.module';
import { Application } from '../../entities/application.entity';
import { Candidate } from '../../entities/candidate.entity';
import { CandidateSkill } from '../../entities/candidate-skill.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { Notification } from '../../entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Candidate, CandidateSkill, JobPosting, Notification]),
    ResumesModule,
  ],
  providers: [MeService, CandidateScopeGuard, RateLimitGuard],
  controllers: [MeController],
})
export class MeModule {}
