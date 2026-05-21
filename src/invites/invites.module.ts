import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        EmailModule,
    ],
    controllers: [InvitesController],
    providers: [InvitesService],
})
export class InvitesModule { }