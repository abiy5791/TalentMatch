import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { CandidateDispatch } from '../../entities/candidate-dispatch.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Company } from '../../entities/company.entity';
import { JobPosting } from '../../entities/job-posting.entity';
import { Placement } from '../../entities/placement.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CandidateDispatch, Candidate, Company, JobPosting, Placement, PipelineStage, Notification, User,
    ]),
    ApplicationsModule,
  ],
  providers: [PortalService],
  controllers: [PortalController],
})
export class PortalModule {}
