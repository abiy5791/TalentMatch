import {
  IsString, IsOptional, IsInt, IsUUID, IsIn, IsNumber, IsDateString, IsObject, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PLACEMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'TERMINATED'] as const;

export class CreatePlacementDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() candidateId: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() jobId: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() companyId: string;
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryOffered?: number;
  @ApiPropertyOptional({ description: 'Fee % of first-year salary' })
  @IsOptional() @IsNumber() feePercentage?: number;
  @ApiPropertyOptional({ enum: PLACEMENT_STATUSES })
  @IsOptional() @IsIn(PLACEMENT_STATUSES as unknown as string[]) status?: string;
}

export class UpdatePlacementDto {
  @ApiPropertyOptional({ enum: PLACEMENT_STATUSES })
  @IsOptional() @IsIn(PLACEMENT_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() salaryOffered?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() feePercentage?: number;
}

export class FeedbackDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional() @IsInt() @Min(1) @Max(5) satisfactionScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() clientFeedback?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() candidateFeedback?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}
