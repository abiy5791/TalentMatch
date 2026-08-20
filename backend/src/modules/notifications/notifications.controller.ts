import { Controller, Get, Post, Param, Body, UseGuards, Req, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P, hasPermission } from '../auth/permissions';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  /** Own inbox only, unless the caller can read users (managers and admins). */
  @Get('user/:id')
  getByUser(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    if (id !== req.user?.sub && !hasPermission(req.user?.role, P.USERS_READ)) {
      throw new ForbiddenException("You can only read your own notifications");
    }
    return this.service.findByUser(id);
  }

  @Get('me')
  getMine(@Req() req: any) { return this.service.findByUser(req.user.sub); }

  @Post()
  @RequirePermissions(P.MATCHING_DISPATCH)
  create(@Body() dto: any) { return this.service.create(dto); }

  @Post(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.markRead(id, req.user.sub, hasPermission(req.user?.role, P.USERS_READ));
  }
}
