import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    // ✅ PUBLIC — no guards, anyone can call these
    @Post('register')
    register(@Body() body: { email: string; password: string; name?: string }) {
        return this.authService.register(body.email, body.password, body.name);
    }

    @Post('login')
    login(@Body() body: { email: string; password: string }) {
        return this.authService.login(body.email, body.password);
    }

    // 🔒 ANY LOGGED IN USER — just needs a valid token
    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@Request() req) {
        return req.user;
    }

    // 🔒 ALL ROLES — any logged in user can access
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('MEMBER', 'ADMIN', 'OWNER')
    @Get('dashboard')
    getDashboard(@Request() req) {
        return {
            message: `Welcome ${req.user.name}, you are a ${req.user.role}`,
        };
    }

    // 🔒 ADMIN + OWNER only — members blocked
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN', 'OWNER')
    @Get('admin-panel')
    getAdminPanel() {
        return { message: 'Admin panel — only admins and owners see this' };
    }

    // 🔒 OWNER only — most restricted
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('OWNER')
    @Delete('organization')
    deleteOrganization() {
        return { message: 'Only owners can delete the organization' };
    }
}