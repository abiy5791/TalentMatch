import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { Application } from '../../entities/application.entity';
import { Notification } from '../../entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Application, Notification])],
  providers: [ApplicationsService],
  controllers: [ApplicationsController],
  // Matching, portal and placements all move applications as a side effect.
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
