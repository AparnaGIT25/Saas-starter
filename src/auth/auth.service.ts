import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async register(email: string, password: string, name?: string) {
        // 1. Check if email already exists
        const existing = await this.usersService.findByEmail(email);
        if (existing) {
            throw new ConflictException('Email already in use');
        }

        // 2. Hash the password — saltRounds=12 means 2^12 hashing rounds
        //    Higher = more secure but slower. 12 is the sweet spot.
        const hashedPassword = await bcrypt.hash(password, 12);

        // 3. Save user to DB with the HASH, never the plain password
        const user = await this.usersService.create({
            email,
            password: hashedPassword,
            name: name ?? null,          // if name is undefined, send null instead
        });

        // 4. Return a JWT token immediately (user is logged in after register)
        return this.signToken(user.id, user.email);
    }

    async login(email: string, password: string) {
        // 1. Find the user by email
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            // Don't say "user not found" — use a generic message for security
            throw new UnauthorizedException('Invalid credentials');
        }

        // 2. Compare plain password against stored hash
        //    bcrypt.compare handles this safely — never do password === user.password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // 3. Return JWT token
        return this.signToken(user.id, user.email);
    }

    // Private helper — creates and signs the JWT
    private signToken(userId: string, email: string) {
        const payload = { sub: userId, email };
        // 'sub' is JWT standard for "subject" = who this token is about
        return {
            access_token: this.jwtService.sign(payload),
            user: { id: userId, email },
        };
    }
}