import { Type } from 'class-transformer';
import {
  IsBoolean, IsString, IsOptional, IsInt, IsArray, IsUUID, IsIn, IsObject, ValidateNested,
  Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const JOB_STATUSES = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'LIVE', 'PAUSED', 'CLOSED', 'FILLED',
] as const;
export const JOB_VISIBILITY = ['PUBLIC', 'PRIVATE', 'CONFIDENTIAL'] as const;

export class RequiredSkillDto {
  @ApiProperty({ example: 'React' })
  @IsString() name: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 4 })
  @IsInt() @Min(1) @Max(5) level: number;
}

export class CreateJobDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() companyId: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() requirements?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() responsibilities?: string[];
  @ApiPropertyOptional({ type: [RequiredSkillDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RequiredSkillDto)
  requiredSkills?: RequiredSkillDto[];
  @ApiPropertyOptional({ type: [RequiredSkillDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RequiredSkillDto)
  niceToHaveSkills?: RequiredSkillDto[];
  @ApiPropertyOptional({ example: { city: 'Austin', country: 'USA', remote: true } })
  @IsOptional() @IsObject() location?: Record<string, any>;
  @ApiPropertyOptional({ example: 'HYBRID' })
  @IsOptional() @IsString() remotePolicy?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional({ example: 'FULL_TIME' })
  @IsOptional() @IsString() employmentType?: string;
  @ApiPropertyOptional({ enum: JOB_VISIBILITY })
  @IsOptional() @IsIn(JOB_VISIBILITY as unknown as string[]) visibility?: string;
  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional() @IsIn(JOB_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional({ description: 'Refuse applications that arrive without a CV' })
  @IsOptional() @IsBoolean() requiresResume?: boolean;
}

export class UpdateJobDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() requirements?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() responsibilities?: string[];
  @ApiPropertyOptional({ type: [RequiredSkillDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RequiredSkillDto)
  requiredSkills?: RequiredSkillDto[];
  @ApiPropertyOptional({ type: [RequiredSkillDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RequiredSkillDto)
  niceToHaveSkills?: RequiredSkillDto[];
  @ApiPropertyOptional() @IsOptional() @IsObject() location?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() remotePolicy?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() employmentType?: string;
  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional() @IsIn(JOB_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional({ enum: JOB_VISIBILITY })
  @IsOptional() @IsIn(JOB_VISIBILITY as unknown as string[]) visibility?: string;
  @ApiPropertyOptional({ description: 'Refuse applications that arrive without a CV' })
  @IsOptional() @IsBoolean() requiresResume?: boolean;
}

export class UpdateJobStatusDto {
  @ApiProperty({ enum: JOB_STATUSES })
  @IsIn(JOB_STATUSES as unknown as string[]) status: string;
}
