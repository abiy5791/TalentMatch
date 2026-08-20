import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, CreateUserDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './decorators/permissions.decorator';
import { PERMISSIONS as P, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS } from './permissions';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.authService.findById(req.user.sub);
  }

  /** Lets the console explain what each role can do without hard-coding it. */
  @Get('roles')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  roles() {
    return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role,
      description: ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS],
      permissions,
    }));
  }

  /** Seeded sign-ins, so the login screen never lists a stale credential. */
  @Get('demo-accounts')
  demoAccounts() {
    return this.authService.demoAccounts();
  }

  @Post('register')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(P.USERS_WRITE)
  register(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Get('users')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(P.USERS_READ)
  getUsers() {
    return this.authService.findAll();
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  logout() {
    // Tokens are stateless; the client drops it. Endpoint exists for audit symmetry.
    return { success: true };
  }
}
