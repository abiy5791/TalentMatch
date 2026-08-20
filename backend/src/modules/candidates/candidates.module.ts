import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { Candidate } from '../../entities/candidate.entity';
import { CandidateSkill } from '../../entities/candidate-skill.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate, CandidateSkill, PipelineStage])],
  providers: [CandidatesService],
  controllers: [CandidatesController],
})
export class CandidatesModule {}
