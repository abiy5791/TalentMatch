import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the permissions a route needs. All listed permissions are required.
 * A route with no decorator is available to any authenticated user who has at
 * least one console permission (see PermissionsGuard).
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
