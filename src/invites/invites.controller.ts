import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private invitesService: InvitesService) {}

  // POST /invites — send invite (OWNER and ADMIN only)
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post()
  sendInvite(
    @Request() req: any,
    @Body() body: { email: string; role?: 'ADMIN' | 'MEMBER' },
  ) {
    return this.invitesService.sendInvite(req.user.id, req.user.activeOrganizationId, body.email, body.role);
  }

  // POST /invites/accept — accept an invite (any logged in user)
  @Post('accept')
  acceptInvite(
    @Request() req: any,
    @Body() body: { token: string },
  ) {
    return this.invitesService.acceptInvite(body.token, req.user.id);
  }

  // GET /invites — list pending invites for my org
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @Get()
  getOrgInvites(@Request() req: any) {
    return this.invitesService.getOrgInvites(req.user.activeOrganizationId);
  }
}
