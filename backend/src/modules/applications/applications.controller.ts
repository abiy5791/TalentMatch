import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationsService, MANUAL_STATUSES } from './applications.service';
import { ApplicationStatus } from '../../entities/application.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

class UpdateApplicationStatusDto {
  @ApiProperty({ enum: MANUAL_STATUSES })
  @IsIn(MANUAL_STATUSES as unknown as string[]) status: ApplicationStatus;

  @ApiPropertyOptional({ description: 'Shown to the applicant on their timeline' })
  @IsOptional() @IsString() note?: string;
}

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApplicationsController {
  constructor(private service: ApplicationsService) {}

  @Get()
  @RequirePermissions(P.CANDIDATES_READ)
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Patch(':id/status')
  @RequirePermissions(P.CANDIDATES_WRITE)
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationStatusDto) {
    return this.service.updateStatus(id, dto.status, dto.note);
  }
}
