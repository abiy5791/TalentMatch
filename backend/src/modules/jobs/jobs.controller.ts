import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto, UpdateJobStatusDto } from './dto/job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobsController {
  constructor(private service: JobsService) {}

  @Get()
  @RequirePermissions(P.JOBS_READ)
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  @RequirePermissions(P.JOBS_READ)
  findById(@Param('id', ParseUUIDPipe) id: string) { return this.service.findById(id); }

  // Recruiters draft roles; the approval gate below is what they cannot pass.
  @Post()
  @RequirePermissions(P.JOBS_WRITE)
  create(@Body() dto: CreateJobDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub, req.user?.role);
  }

  @Put(':id')
  @RequirePermissions(P.JOBS_WRITE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobDto, @Req() req: any) {
    return this.service.update(id, dto, req.user?.role);
  }

  @Patch(':id/approve')
  @RequirePermissions(P.JOBS_APPROVE)
  approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.approve(id, req.user?.sub);
  }

  @Patch(':id/publish')
  @RequirePermissions(P.JOBS_APPROVE)
  publish(@Param('id', ParseUUIDPipe) id: string) { return this.service.publish(id); }

  @Patch(':id/status')
  @RequirePermissions(P.JOBS_APPROVE)
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Patch(':id/submit')
  @RequirePermissions(P.JOBS_WRITE)
  submitForApproval(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.submitForApproval(id);
  }

  @Delete(':id')
  @RequirePermissions(P.JOBS_CLOSE)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
