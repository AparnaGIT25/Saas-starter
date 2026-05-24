import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { InvitesModule } from './invites/invites.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organization.module';
import { BillingModule } from './billing/billing.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    InvitesModule,
    OrganizationsModule,
    BillingModule,
  ],
  providers: [AppService],
})
export class AppModule {}
