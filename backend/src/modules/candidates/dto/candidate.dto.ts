import { Type } from 'class-transformer';
import {
  IsString, IsOptional, IsEmail, IsInt, IsIn, IsArray, IsBoolean, IsNumber, IsUUID,
  ValidateNested, Min, Max, IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CANDIDATE_STATUSES = [
  'UNASSIGNED', 'SCREENING', 'MATCHED', 'SENT_TO_COMPANY',
  'INTERVIEWING', 'OFFERED', 'PLACED', 'ARCHIVED',
] as const;

export class SkillDto {
  @ApiProperty({ example: 'React' })
  @IsString() skillName: string;

  @ApiPropertyOptional({ example: 'Frontend' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional() @IsInt() @Min(1) @Max(5) proficiencyLevel?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() yearsOfExperience?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreateCandidateDto {
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional({ example: { city: 'Austin', country: 'USA' } })
  @IsOptional() @IsObject() location?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() currentTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currentCompany?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() experienceYears?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryExpectationMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryExpectationMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() noticePeriodDays?: number;
  @ApiPropertyOptional({ example: 'IMMEDIATE' })
  @IsOptional() @IsString() availability?: string;
  @ApiPropertyOptional({ enum: CANDIDATE_STATUSES })
  @IsOptional() @IsIn(CANDIDATE_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resumeUrl?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() assignedRecruiterId?: string;
  @ApiPropertyOptional({ type: [SkillDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SkillDto) skills?: SkillDto[];
}

export class UpdateCandidateDto {
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
  @ApiPropertyOptional() @IsOptional() @IsString() availability?: string;
  @ApiPropertyOptional({ enum: CANDIDATE_STATUSES })
  @IsOptional() @IsIn(CANDIDATE_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resumeUrl?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() assignedRecruiterId?: string;
  @ApiPropertyOptional({ type: [SkillDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SkillDto) skills?: SkillDto[];
}

export class UpdateStatusDto {
  @ApiProperty({ enum: CANDIDATE_STATUSES })
  @IsIn(CANDIDATE_STATUSES as unknown as string[]) status: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() notes?: string;
}

export class VerifyDto {
  @ApiProperty({ example: { identity: true, references: true, backgroundCheck: false } })
  @IsObject() flags: Record<string, boolean>;
}

export class SetSkillsDto {
  @ApiProperty({ type: [SkillDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => SkillDto) skills: SkillDto[];
}
