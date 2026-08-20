import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MatchingModule } from './modules/matching/matching.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { PlacementsModule } from './modules/placements/placements.module';
import { PortalModule } from './modules/portal/portal.module';
import { PublicModule } from './modules/public/public.module';
import { ResumesModule } from './modules/resumes/resumes.module';
import { MeModule } from './modules/me/me.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SeedModule } from './seed/seed.module';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'recruitment',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      namingStrategy: new SnakeNamingStrategy(),
      // Schema is owned by TypeORM in dev; database/schema.sql documents the
      // equivalent DDL for environments that provision the database up front.
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      logging: process.env.DB_LOGGING === 'true',
      retryAttempts: 10,
      retryDelay: 3000,
    }),
    AuthModule,
    CompaniesModule,
    CandidatesModule,
    JobsModule,
    MatchingModule,
    PipelineModule,
    PlacementsModule,
    PortalModule,
    PublicModule,
    ResumesModule,
    MeModule,
    ApplicationsModule,
    AnalyticsModule,
    NotificationsModule,
    SeedModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
