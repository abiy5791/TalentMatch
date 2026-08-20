import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlacementsService } from './placements.service';
import { CreatePlacementDto, UpdatePlacementDto, FeedbackDto } from './dto/placement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

@ApiTags('placements')
@ApiBearerAuth()
@Controller('placements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlacementsController {
  constructor(private service: PlacementsService) {}

  // Fee figures are stripped for callers without analytics:financials.
  @Get()
  @RequirePermissions(P.PLACEMENTS_READ)
  findAll(@Query() query: any, @Req() req: any) {
    return this.service.findAll(query, req.user?.role);
  }

  @Get(':id')
  @RequirePermissions(P.PLACEMENTS_READ)
  findById(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.findById(id, req.user?.role);
  }

  @Post()
  @RequirePermissions(P.PLACEMENTS_WRITE)
  create(@Body() dto: CreatePlacementDto) { return this.service.create(dto); }

  @Put(':id')
  @RequirePermissions(P.PLACEMENTS_WRITE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlacementDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/feedback')
  @RequirePermissions(P.PLACEMENTS_WRITE)
  addFeedback(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FeedbackDto) {
    return this.service.addFeedback(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(P.PLACEMENTS_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
