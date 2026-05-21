import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
    constructor(private billingService: BillingService) { }

    @UseGuards(RolesGuard)
    @Roles('OWNER')
    @Post('checkout')
    createCheckout(
        @Request() req,
        @Body() body: { plan: 'PRO' | 'ENTERPRISE' },
    ) {
        return this.billingService.createCheckoutSession(req.user.id, body.plan);
    }

    @UseGuards(RolesGuard)
    @Roles('OWNER')
    @Post('portal')
    createPortal(@Request() req) {
        return this.billingService.createBillingPortal(req.user.id);
    }

    @Get('subscription')
    getSubscription(@Request() req) {
        return this.billingService.getSubscription(req.user.id);
    }
}