import { IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * What an applicant may change about themselves. Notably absent: pipeline
 * status, verification flags, assigned recruiter and source — those belong to
 * the recruiting team.
 */
export class UpdateMyProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() location?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() currentTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currentCompany?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() experienceYears?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryExpectationMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryExpectationMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() noticePeriodDays?: number;
  @ApiPropertyOptional({ example: 'IMMEDIATE' })
  @IsOptional() @IsString() availability?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resumeUrl?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() skills?: string[];
}

/**
 * Applying while signed in. Everything the public form asks for is already on
 * file, so this carries only what is specific to the application.
 */
export class ApplyAsCandidateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID() jobId: string;

  @ApiPropertyOptional({ description: 'Why you are a fit' })
  @IsOptional() @IsString() coverNote?: string;

  /**
   * A freshly uploaded CV. Left out, the CV already on the profile is used —
   * which is the whole point of having an account.
   */
  @ApiPropertyOptional({ format: 'uuid', description: 'From POST /me/resume' })
  @IsOptional() @IsUUID() resumeId?: string;
}

export class WithdrawDto {
  @ApiPropertyOptional({ description: 'Optional reason, shared with your recruiter' })
  @IsOptional() @IsString() reason?: string;
}
