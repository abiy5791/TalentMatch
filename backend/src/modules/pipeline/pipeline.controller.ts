import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PipelineService } from './pipeline.service';
import { TransitionDto } from './dto/pipeline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

@ApiTags('pipeline')
@ApiBearerAuth()
@Controller('pipeline')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PipelineController {
  constructor(private service: PipelineService) {}

  // Declared before the ':type' routes so the literal path is not captured by the param.
  @Get('stages')
  @RequirePermissions(P.PIPELINE_READ)
  getStages() { return this.service.getStageDefinitions(); }

  @Post('transition')
  @RequirePermissions(P.PIPELINE_TRANSITION)
  transition(@Body() dto: TransitionDto, @Req() req: any) {
    return this.service.transition(
      { ...dto, changedById: dto.changedById || req.user?.sub },
      req.user?.role,
    );
  }

  @Get(':type')
  @RequirePermissions(P.PIPELINE_READ)
  getPipeline(@Param('type') type: string, @Req() req: any) {
    return this.service.getPipeline(type, req.user?.role);
  }

  @Get(':type/counts')
  @RequirePermissions(P.PIPELINE_READ)
  getCounts(@Param('type') type: string) { return this.service.getStageCounts(type); }

  @Get(':type/:id/history')
  @RequirePermissions(P.PIPELINE_READ)
  getHistory(@Param('type') type: string, @Param('id') id: string) {
    return this.service.getEntityStages(type, id);
  }
}
