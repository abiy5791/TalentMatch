import {
  IsArray, IsEmail, IsInt, IsObject, IsOptional, IsString, IsUUID, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID() jobId: string;

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
  @ApiPropertyOptional({ example: 'IMMEDIATE' })
  @IsOptional() @IsString() availability?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() skills?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() resumeUrl?: string;

  /**
   * The id returned by POST /public/resumes. Whether it is required depends on
   * the role, so the service enforces it rather than this DTO.
   */
  @ApiPropertyOptional({ format: 'uuid', description: 'From POST /public/resumes' })
  @IsOptional() @IsUUID() resumeId?: string;
  @ApiPropertyOptional({ description: 'Why they are a fit' })
  @IsOptional() @IsString() coverNote?: string;

  /**
   * Optional. Supplying one creates a candidate login so the applicant can track
   * their progress; leaving it blank still submits the application.
   */
  @ApiPropertyOptional({ minLength: 6, description: 'Creates a tracking login' })
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
