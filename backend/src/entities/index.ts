/**
 * The entity registry.
 *
 * Listed by hand rather than discovered with a `__dirname` glob: a glob is
 * resolved at runtime against a directory, which is exactly the thing a
 * serverless bundler cannot see. On Vercel the function is traced from static
 * `require`s, so an entity nothing imports is an entity that is not deployed —
 * and the first symptom is "No metadata for X was found" in production.
 *
 * Add new entities here.
 */
import { ActivityLog } from './activity-log.entity';
import { AppSetting } from './app-setting.entity';
import { Application } from './application.entity';
import { Candidate } from './candidate.entity';
import { CandidateDispatch } from './candidate-dispatch.entity';
import { CandidateSkill } from './candidate-skill.entity';
import { Company } from './company.entity';
import { JobPosting } from './job-posting.entity';
import { MatchScore } from './match-score.entity';
import { Notification } from './notification.entity';
import { PipelineStage } from './pipeline-stage.entity';
import { Placement } from './placement.entity';
import { ResumeFile } from './resume-file.entity';
import { User } from './user.entity';

export const ENTITIES = [
  ActivityLog,
  AppSetting,
  Application,
  Candidate,
  CandidateDispatch,
  CandidateSkill,
  Company,
  JobPosting,
  MatchScore,
  Notification,
  PipelineStage,
  Placement,
  ResumeFile,
  User,
];

export {
  ActivityLog, AppSetting, Application, Candidate, CandidateDispatch, CandidateSkill,
  Company, JobPosting, MatchScore, Notification, PipelineStage, Placement, ResumeFile, User,
};
