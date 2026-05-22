import * as common from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@common.Controller('billing')
export class BillingController {
    constructor(private billingService: BillingService) { }

    // NO auth guard — Stripe calls this directly
    @common.Post('webhook')
    async handleWebhook(
        @common.Headers('stripe-signature') signature: string,
        @common.Req() req: common.RawBodyRequest<Request>,
    ) {
        return this.billingService.handleWebhook(signature, req.rawBody!);
    }

    @common.UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('OWNER')
    @common.Post('checkout')
    createCheckout(
        @common.Request() req,
        @common.Body() body: { plan: 'PRO' | 'ENTERPRISE' },
    ) {
        return this.billingService.createCheckoutSession(req.user.id, body.plan);
    }

    @common.UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('OWNER')
    @common.Post('portal')
    createPortal(@common.Request() req) {
        return this.billingService.createBillingPortal(req.user.id);
    }

    @common.UseGuards(JwtAuthGuard)
    @common.Get('subscription')
    getSubscription(@common.Request() req) {
        return this.billingService.getSubscription(req.user.id);
    }
}