import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrganizationsService } from './organization.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private orgsService: OrganizationsService) {}

  // POST /organizations
  @Post()
  create(
    @Request() req: any,
    @Body() body: { name: string; slug: string },
  ) {
    return this.orgsService.create(req.user.id, body.name, body.slug);
  }

  // GET /organizations/me
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @Get('me')
  getMyOrg(@Request() req: any) {
    return this.orgsService.findOrg(req.user.activeOrganizationId);
  }

  // PATCH /organizations/me
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch('me')
  updateMyOrg(
    @Request() req: any,
    @Body() body: { name?: string; slug?: string },
  ) {
    return this.orgsService.update(req.user.activeOrganizationId, body);
  }

  // GET /organizations/members
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @Get('members')
  getMembers(@Request() req: any) {
    return this.orgsService.getMembers(req.user.activeOrganizationId);
  }

  // PATCH /organizations/members/:id/role
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch('members/:id/role')
  updateMemberRole(
    @Request() req: any,
    @Param('id') targetUserId: string,
    @Body() body: { role: 'ADMIN' | 'MEMBER' },
  ) {
    return this.orgsService.updateMemberRole(
      req.user.activeOrganizationId,
      targetUserId,
      body.role,
    );
  }

  // DELETE /organizations/members/:id
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Delete('members/:id')
  removeMember(
    @Request() req: any,
    @Param('id') targetUserId: string,
  ) {
    return this.orgsService.removeMember(req.user.activeOrganizationId, targetUserId);
  }
}
