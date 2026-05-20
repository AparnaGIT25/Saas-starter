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
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        // 1. Read which roles are required for this route
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(), // check method-level decorator first
            context.getClass(),   // then check class-level decorator
        ]);

        // 2. If no @Roles() on this route — let everyone through
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        // 3. Get the logged-in user from request (set by JwtAuthGuard)
        const { user } = context.switchToHttp().getRequest();

        // 4. Check if user's role is in the allowed roles list
        if (!requiredRoles.includes(user.role)) {
            throw new ForbiddenException(
                `Access denied. Required: ${requiredRoles.join(', ')}. Your role: ${user.role}`
            );
        }

        return true;
    }
}