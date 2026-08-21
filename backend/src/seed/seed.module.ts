import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { Candidate } from '../entities/candidate.entity';
import { CandidateSkill } from '../entities/candidate-skill.entity';
import { JobPosting } from '../entities/job-posting.entity';
import { PipelineStage } from '../entities/pipeline-stage.entity';
import { Placement } from '../entities/placement.entity';
import { CandidateDispatch } from '../entities/candidate-dispatch.entity';
import { Application } from '../entities/application.entity';
import { MatchingModule } from '../modules/matching/matching.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Company, Candidate, CandidateSkill, JobPosting, PipelineStage, Placement, CandidateDispatch, Application]),
    MatchingModule,
  ],
  providers: [SeedService],
  // The `db:setup` CLI drives seeding explicitly where boot-time seeding is off.
  exports: [SeedService],
})
export class SeedModule {}
