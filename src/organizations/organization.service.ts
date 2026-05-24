import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

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
    await this.prisma.organizationMember.create({
      data: {
        userId,
        organizationId: org.id,
        role: 'OWNER',
      },
    });

    return org;
  }

  // Get org details
  async findOrg(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  // Update org
  async update(orgId: string, data: { name?: string; slug?: string }) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data,
    });
  }

  // Get all members of the org
  async getMembers(orgId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: true },
    });

    return members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.createdAt,
    }));
  }

  // Change a member's role
  async updateMemberRole(
    orgId: string,
    targetUserId: string,
    newRole: 'ADMIN' | 'MEMBER',
  ) {
    const targetMember = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      include: { user: true },
    });

    if (!targetMember) throw new NotFoundException('Member not found in this organization');

    // Cannot change an OWNER's role
    if (targetMember.role === 'OWNER') {
      throw new ForbiddenException('Cannot change the role of an OWNER');
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: targetMember.id },
      data: { role: newRole },
      include: { user: true },
    });

    return { id: updated.user.id, email: updated.user.email, name: updated.user.name, role: updated.role };
  }

  // Remove a member from the org
  async removeMember(orgId: string, targetUserId: string) {
    const targetMember = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      include: { user: true },
    });

    if (!targetMember) throw new NotFoundException('Member not found in this organization');

    // Cannot remove an OWNER
    if (targetMember.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove the organization owner');
    }

    // Delete the membership
    await this.prisma.organizationMember.delete({
      where: { id: targetMember.id },
    });

    return { id: targetMember.user.id, email: targetMember.user.email, name: targetMember.user.name };
  }
}
