import { DocumentBuilder } from '@nestjs/swagger';

/**
 * The API description, shared by the long-running server and the serverless
 * handler so the docs at /api/docs are the same document either way.
 */
export function swaggerConfig() {
  return new DocumentBuilder()
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
}
