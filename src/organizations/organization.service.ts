import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
    constructor(private prisma: PrismaService) { }

    // Create a new org and make the creator the OWNER
    async create(userId: string, name: string, slug: string) {
        // 1. Check slug is unique
        const existing = await this.prisma.organization.findUnique({
            where: { slug },
        });
        if (existing) throw new ConflictException('Slug already taken');

        // 2. Create the organization
        const org = await this.prisma.organization.create({
            data: { name, slug },
        });

        // 3. Link the user to this org and make them OWNER
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                organizationId: org.id,
                role: 'OWNER',
            },
        });

        return org;
    }

    // Get org — only if user belongs to it
    async findMyOrg(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true },
        });

        if (!user?.organization) {
            throw new NotFoundException('You are not part of any organization');
        }

        return user.organization;
    }

    // Update org — scoped to user's own org only
    async update(userId: string, data: { name?: string; slug?: string }) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user?.organizationId) {
            throw new NotFoundException('You are not part of any organization');
        }

        return this.prisma.organization.update({
            where: { id: user.organizationId },
            data,
        });
    }

    // Get all members of the user's org
    async getMembers(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user?.organizationId) {
            throw new NotFoundException('You are not part of any organization');
        }

        return this.prisma.user.findMany({
            where: { organizationId: user.organizationId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                // password is NOT selected — never expose it
            },
        });
    }

    // Change a member's role
    async updateMemberRole(
        requestingUserId: string,
        targetUserId: string,
        newRole: 'ADMIN' | 'MEMBER',
    ) {
        const requestingUser = await this.prisma.user.findUnique({
            where: { id: requestingUserId },
        });

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        // Must be in same org
        if (requestingUser?.organizationId !== targetUser?.organizationId) {
            throw new ForbiddenException(
                'Cannot manage users outside your organization',
            );
        }

        // Cannot change an OWNER's role
        if (targetUser?.role === 'OWNER') {
            throw new ForbiddenException('Cannot change the role of an OWNER');
        }

        return this.prisma.user.update({
            where: { id: targetUserId },
            data: { role: newRole },
            select: { id: true, email: true, name: true, role: true },
        });
    }

    // Remove a member from the org
    async removeMember(requestingUserId: string, targetUserId: string) {
        const requestingUser = await this.prisma.user.findUnique({
            where: { id: requestingUserId },
        });

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        // Must be in same org
        if (requestingUser?.organizationId !== targetUser?.organizationId) {
            throw new ForbiddenException(
                'Cannot manage users outside your organization',
            );
        }

        // Cannot remove an OWNER
        if (targetUser?.role === 'OWNER') {
            throw new ForbiddenException('Cannot remove the organization owner');
        }

        // Remove from org by setting organizationId to null
        return this.prisma.user.update({
            where: { id: targetUserId },
            data: { organizationId: null, role: 'MEMBER' },
            select: { id: true, email: true, name: true },
        });
    }
}