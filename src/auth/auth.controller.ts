import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')                          // POST /auth/register
    register(@Body() body: { email: string; password: string; name?: string }) {
        return this.authService.register(body.email, body.password, body.name);
    }

    @Post('login')                             // POST /auth/login
    login(@Body() body: { email: string; password: string }) {
        return this.authService.login(body.email, body.password);
    }

    @UseGuards(JwtAuthGuard)                   // 🔒 protected route
    @Get('me')                                 // GET /auth/me
    getMe(@Request() req) {
        return req.user;                         // set by JwtStrategy.validate()
    }
}