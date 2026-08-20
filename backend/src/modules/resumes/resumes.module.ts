import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResumeStorageService } from './resume-storage.service';
import { PublicResumesController, ResumesController } from './resumes.controller';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { ResumeFile } from '../../entities/resume-file.entity';
import { Candidate } from '../../entities/candidate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ResumeFile, Candidate])],
  providers: [ResumeStorageService, RateLimitGuard],
  controllers: [ResumesController, PublicResumesController],
  // The public board and the applicant area both attach CVs.
  exports: [ResumeStorageService],
})
export class ResumesModule {}
