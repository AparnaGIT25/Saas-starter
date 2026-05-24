import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Read which roles are required for this route
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), // check method-level decorator first
      context.getClass(), // then check class-level decorator
    ]);

    // 2. If no @Roles() on this route — let everyone through
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 3. Get the logged-in user and request from context
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    // 4. Extract active organization ID from headers
    const orgId = request.headers['x-organization-id'];

    if (!orgId) {
      throw new ForbiddenException('x-organization-id header is required');
    }

    // 5. Find the membership for this organization
    const membership = user.memberships?.find((m: any) => m.organizationId === orgId);

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // 6. Check if the user's role in this organization is allowed
    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Access denied. Required: ${requiredRoles.join(', ')}. Your role: ${membership.role}`,
      );
    }

    // Optional: attach the active membership role to the request so controllers can use it easily
    request.user.activeRole = membership.role;
    request.user.activeOrganizationId = orgId;

    return true;
  }
}
