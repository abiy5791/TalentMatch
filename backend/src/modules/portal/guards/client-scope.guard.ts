import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isClientRole } from '../../auth/permissions';

/**
 * Establishes the company a portal request is allowed to touch.
 *
 * The id comes from the signed token and is written to `request.companyScope`.
 * Portal services take their scope from there and never from a route or query
 * parameter, so there is no id a client could substitute to read another
 * employer's data.
 */
@Injectable()
export class ClientScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !isClientRole(user.role)) {
      throw new ForbiddenException('The client portal is for employer accounts only');
    }
    if (!user.companyId) {
      throw new ForbiddenException(
        'This portal account is not linked to a company. Ask your account manager to fix it.',
      );
    }

    request.companyScope = user.companyId;
    return true;
  }
}
