import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, isClientRole, permissionsFor } from '../permissions';

const isPortalPermission = (p: string) => p.startsWith('portal:');

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Not authenticated');

    const granted = permissionsFor(user.role);
    if (!granted.length) {
      throw new ForbiddenException('This account has no permissions assigned');
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const missing = required.filter(p => !granted.includes(p));
    if (!missing.length) return true;

    // Point people at the surface they belong on rather than a bare denial.
    const wantsPortal = required.every(isPortalPermission);
    if (isClientRole(user.role) && !wantsPortal) {
      throw new ForbiddenException(
        'Employer accounts use the client portal, not the recruiter console',
      );
    }
    if (!isClientRole(user.role) && wantsPortal) {
      throw new ForbiddenException(
        'The client portal is for employer accounts; use the recruiter console',
      );
    }
    throw new ForbiddenException(`Your role (${user.role}) is missing: ${missing.join(', ')}`);
  }
}
