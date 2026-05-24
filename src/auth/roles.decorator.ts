import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// This key is used to store and retrieve role metadata
export const ROLES_KEY = 'roles';

// Usage: @Roles('OWNER', 'ADMIN')
// This stamps the route with which roles are allowed
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
