import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Company } from '../../entities/company.entity';
import { Placement } from '../../entities/placement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PipelineStage, Candidate, Company, Placement])],
  providers: [PipelineService],
  controllers: [PipelineController],
})
export class PipelineModule {}
