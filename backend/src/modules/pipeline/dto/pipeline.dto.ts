import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransitionDto {
  @ApiProperty({ enum: ['COMPANY', 'CANDIDATE', 'PLACEMENT'] })
  @IsIn(['COMPANY', 'CANDIDATE', 'PLACEMENT', 'company', 'candidate', 'placement'])
  entityType: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  entityId: string;

  @ApiProperty({ example: 'INTERVIEWING' })
  @IsString()
  stage: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'User making the change' })
  @IsOptional()
  @IsUUID()
  changedById?: string;
}
