import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { randomBytes } from 'crypto';

@Injectable()
export class InvitesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async sendInvite(
    inviterId: string,
    orgId: string,
    email: string,
    role: 'ADMIN' | 'MEMBER' = 'MEMBER',
  ) {
    // 1. Get the inviter and their organization
    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
    });

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // 2. Check if this email is already a member of this org
    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      const existingMember = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
      });
      if (existingMember) {
        throw new ConflictException(
          'This user is already a member of your organization',
        );
      }
    }

    // 3. Check if there is already a pending non-expired invite
    const existingInvite = await this.prisma.invite.findFirst({
      where: {
        email,
        organizationId: orgId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) {
      throw new ConflictException(
        'A pending invite already exists for this email',
      );
    }

    // 4. Generate secure random token
    // 32 bytes = 64 hex characters — impossible to guess
    const token = randomBytes(32).toString('hex');

    // 5. Set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 6. Save invite to database
    const invite = await this.prisma.invite.create({
      data: {
        email,
        role,
        token,
        organizationId: orgId,
        invitedById: inviterId,
        expiresAt,
      },
    });

    // 7. Send the invite email
    await this.emailService.sendInviteEmail(
      email,
      org.name,
      inviter?.name ?? inviter?.email ?? 'Someone',
      token,
    );

    return {
      message: `Invite sent successfully to ${email}`,
      inviteId: invite.id,
    };
  }

  async acceptInvite(token: string, userId: string) {
    // 1. Find invite by token
    const invite = await this.prisma.invite.findUnique({
      where: { token },
    });

    // 2. Edge case: token does not exist at all
    if (!invite) {
      throw new NotFoundException('Invalid invite token');
    }

    // 3. Edge case: invite was already accepted before
    if (invite.acceptedAt) {
      throw new BadRequestException('This invite has already been accepted');
    }

    // 4. Edge case: invite token has expired
    if (invite.expiresAt < new Date()) {
      throw new GoneException(
        'This invite has expired. Please ask for a new invitation',
      );
    }

    // 5. Get the user who is accepting
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // 6. Edge case: logged in user's email does not match invite email
    if (user?.email !== invite.email) {
      throw new ForbiddenException(
        'This invite was sent to a different email address',
      );
    }

    // 7. Check if user is already in this organization
    const existingMember = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
    });

    if (existingMember) {
      throw new ConflictException(
        'You are already a member of this organization',
      );
    }

    // 8. Create the membership record
    await this.prisma.organizationMember.create({
      data: {
        userId: userId,
        organizationId: invite.organizationId,
        role: invite.role,
      },
    });

    // 9. Mark invite as accepted so it cannot be used again
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return {
      message: 'You have successfully joined the organization',
    };
  }

  // List all pending invites for the user's organization
  async getOrgInvites(orgId: string) {
    return this.prisma.invite.findMany({
      where: {
        organizationId: orgId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
