import {
    Controller,
    Post,
    Get,
    Body,
    Headers,
    UseGuards,
    Request,
    RawBodyRequest,
    Req,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('billing')
export class BillingController {
    constructor(private billingService: BillingService) { }

    // NO auth guard — Stripe calls this directly
    @Post('webhook')
    async handleWebhook(
        @Headers('stripe-signature') signature: string,
        @Req() req: RawBodyRequest<Request>,
    ) {
        return this.billingService.handleWebhook(signature, req.rawBody!);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('OWNER')
    @Post('checkout')
    createCheckout(
        @Request() req,
        @Body() body: { plan: 'PRO' | 'ENTERPRISE' },
    ) {
        return this.billingService.createCheckoutSession(req.user.id, body.plan);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('OWNER')
    @Post('portal')
    createPortal(@Request() req) {
        return this.billingService.createBillingPortal(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('subscription')
    getSubscription(@Request() req) {
        return this.billingService.getSubscription(req.user.id);
    }
}