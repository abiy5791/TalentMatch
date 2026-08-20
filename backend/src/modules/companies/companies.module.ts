import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { Company } from '../../entities/company.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company, PipelineStage])],
  providers: [CompaniesService],
  controllers: [CompaniesController],
})
export class CompaniesModule {}
