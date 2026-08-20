import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto, UpdateCompanyStatusDto } from './dto/company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS as P } from '../auth/permissions';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(private service: CompaniesService) {}

  @Get()
  @RequirePermissions(P.COMPANIES_READ)
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  @RequirePermissions(P.COMPANIES_READ)
  findById(@Param('id', ParseUUIDPipe) id: string) { return this.service.findById(id); }

  // Client accounts and their commercial tier are owned by managers.
  @Post()
  @RequirePermissions(P.COMPANIES_WRITE)
  create(@Body() dto: CreateCompanyDto) { return this.service.create(dto); }

  @Post('bulk')
  @RequirePermissions(P.COMPANIES_WRITE)
  bulk(@Body() body: { companies: CreateCompanyDto[] }) {
    return Promise.all(body.companies.map(c => this.service.create(c)));
  }

  @Put(':id')
  @RequirePermissions(P.COMPANIES_WRITE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(P.COMPANIES_WRITE)
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyStatusDto, @Req() req: any) {
    return this.service.updateStatus(id, dto.status, dto.notes, req.user?.sub);
  }

  @Delete(':id')
  @RequirePermissions(P.COMPANIES_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
