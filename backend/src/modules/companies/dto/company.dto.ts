import { IsString, IsOptional, IsIn, IsArray, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;
export const COMPANY_TIERS = ['STANDARD', 'VIP', 'RETAINER'] as const;
export const COMPANY_STATUSES = ['LEAD', 'ONBOARDED', 'ACTIVE', 'FULFILLED', 'INACTIVE', 'REJECTED'] as const;

export class CreateCompanyDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional({ enum: COMPANY_SIZES })
  @IsOptional() @IsIn(COMPANY_SIZES as unknown as string[]) size?: string;
  @ApiPropertyOptional({ example: { city: 'Austin', country: 'USA' } })
  @IsOptional() @IsObject() location?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() cultureTags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional({ enum: COMPANY_TIERS })
  @IsOptional() @IsIn(COMPANY_TIERS as unknown as string[]) tier?: string;
  @ApiPropertyOptional({ enum: COMPANY_STATUSES })
  @IsOptional() @IsIn(COMPANY_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() accountManagerId?: string;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional({ enum: COMPANY_SIZES })
  @IsOptional() @IsIn(COMPANY_SIZES as unknown as string[]) size?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() location?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() cultureTags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional({ enum: COMPANY_TIERS })
  @IsOptional() @IsIn(COMPANY_TIERS as unknown as string[]) tier?: string;
  @ApiPropertyOptional({ enum: COMPANY_STATUSES })
  @IsOptional() @IsIn(COMPANY_STATUSES as unknown as string[]) status?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() accountManagerId?: string;
}

export class UpdateCompanyStatusDto {
  @ApiProperty({ enum: COMPANY_STATUSES })
  @IsIn(COMPANY_STATUSES as unknown as string[]) status: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
