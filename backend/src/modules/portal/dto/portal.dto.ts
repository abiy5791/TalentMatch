import { Type } from 'class-transformer';
import {
  IsArray, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min,
  MinLength, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DECISIONS = ['SHORTLIST', 'INTERVIEW', 'DECLINE'] as const;

export class RespondDto {
  @ApiProperty({ enum: DECISIONS })
  @IsIn(DECISIONS as unknown as string[])
  decision: 'SHORTLIST' | 'INTERVIEW' | 'DECLINE';

  @ApiPropertyOptional({ description: 'Shown to the recruiting team' })
  @IsOptional() @IsString() note?: string;
}

export class PortalFeedbackDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional() @IsInt() @Min(1) @Max(5) satisfactionScore?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() comment?: string;
}

class SkillRequirement {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) level: number;
}

export class RequestRoleDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional({ example: { city: 'Austin', country: 'USA', remote: true } })
  @IsOptional() @IsObject() location?: Record<string, any>;
  @ApiPropertyOptional({ example: 'HYBRID' })
  @IsOptional() @IsString() remotePolicy?: string;
  @ApiPropertyOptional({ example: 'FULL_TIME' })
  @IsOptional() @IsString() employmentType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryMax?: number;
  @ApiPropertyOptional({ type: [SkillRequirement] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SkillRequirement)
  requiredSkills?: SkillRequirement[];
}

export const PORTAL_ROLES = ['CLIENT_ADMIN', 'CLIENT_USER'] as const;

export class InviteColleagueDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 6 }) @IsString() @MinLength(6) password: string;
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;

  /** Portal roles only — an account owner cannot mint internal staff logins. */
  @ApiProperty({ enum: PORTAL_ROLES })
  @IsIn(PORTAL_ROLES as unknown as string[]) role: string;
}

export class TeamStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsIn(['ACTIVE', 'SUSPENDED']) status: string;
}

export class TeamRoleDto {
  @ApiProperty({ enum: PORTAL_ROLES })
  @IsIn(PORTAL_ROLES as unknown as string[]) role: string;
}
