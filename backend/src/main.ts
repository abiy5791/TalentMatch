import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.PORT || '3001', 10);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(compression());
  app.enableCors({ origin: process.env.CORS_ORIGIN || true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Recruitment Platform API')
    .setDescription('Talent Matching & Recruitment Management API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication and user management')
    .addTag('companies', 'Employer profiles, tiers and onboarding')
    .addTag('candidates', 'Talent profiles, skills and verification')
    .addTag('jobs', 'Job postings, approval and publishing')
    .addTag('matching', 'Match scoring and talent dispatch')
    .addTag('pipeline', 'Lifecycle stage tracking')
    .addTag('placements', 'Placements, fees and feedback')
    .addTag('analytics', 'Dashboards, gap analysis and reporting')
    .addTag('public', 'The unauthenticated job board: browse live roles and apply')
    .addTag('resumes', 'CV upload and guarded download')
    .addTag('applications', 'Inbound applications and the status a recruiter sets')
    .addTag('candidate', 'Applicant self-service: own profile and own applications')
    .addTag('portal', 'Employer portal: submitted talent, roles and placements')
    .addTag('notifications', 'In-app and email notifications')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(port, '0.0.0.0');
  Logger.log(`Recruitment Platform API running on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`API docs available at http://localhost:${port}/api/docs`, 'Bootstrap');
}
bootstrap();
