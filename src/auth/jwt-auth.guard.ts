import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// This is what you put on protected routes: @UseGuards(JwtAuthGuard)
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
