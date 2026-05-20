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
    constructor(private orgsService: OrganizationsService) { }

    // POST /organizations
    @Post()
    create(
        @Request() req,
        @Body() body: { name: string; slug: string },
    ) {
        return this.orgsService.create(req.user.id, body.name, body.slug);
    }

    // GET /organizations/me
    @Get('me')
    getMyOrg(@Request() req) {
        return this.orgsService.findMyOrg(req.user.id);
    }

    // PATCH /organizations/me
    @UseGuards(RolesGuard)
    @Roles('OWNER', 'ADMIN')
    @Patch('me')
    updateMyOrg(
        @Request() req,
        @Body() body: { name?: string; slug?: string },
    ) {
        return this.orgsService.update(req.user.id, body);
    }

    // GET /organizations/members
    @Get('members')
    getMembers(@Request() req) {
        return this.orgsService.getMembers(req.user.id);
    }

    // PATCH /organizations/members/:id/role
    @UseGuards(RolesGuard)
    @Roles('OWNER', 'ADMIN')
    @Patch('members/:id/role')
    updateMemberRole(
        @Request() req,
        @Param('id') targetUserId: string,
        @Body() body: { role: 'ADMIN' | 'MEMBER' },
    ) {
        return this.orgsService.updateMemberRole(
            req.user.id,
            targetUserId,
            body.role,
        );
    }

    // DELETE /organizations/members/:id
    @UseGuards(RolesGuard)
    @Roles('OWNER', 'ADMIN')
    @Delete('members/:id')
    removeMember(@Request() req, @Param('id') targetUserId: string) {
        return this.orgsService.removeMember(req.user.id, targetUserId);
    }
}