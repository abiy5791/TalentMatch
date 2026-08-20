import { ArrayNotEmpty, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DISPATCH_METHODS = ['DASHBOARD', 'EMAIL', 'BOTH'] as const;

export class DispatchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID() jobId: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray() @ArrayNotEmpty() @IsUUID(undefined, { each: true }) candidateIds: string[];

  @ApiPropertyOptional({ enum: DISPATCH_METHODS, default: 'DASHBOARD' })
  @IsOptional() @IsIn(DISPATCH_METHODS as unknown as string[]) method?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() message?: string;

  @ApiPropertyOptional({ description: 'Overrides the account manager as recipient' })
  @IsOptional() @IsEmail() recipientEmail?: string;
}

export class BatchDispatchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID() jobId: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 25 })
  @IsOptional() @IsInt() @Min(1) @Max(25) topN?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() message?: string;
}
