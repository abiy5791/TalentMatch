import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobPosting } from '../../entities/job-posting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosting])],
  providers: [JobsService],
  controllers: [JobsController],
})
export class JobsModule {}
