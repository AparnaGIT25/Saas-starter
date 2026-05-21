import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
    private stripe;

    constructor(
        private config: ConfigService,
        private prisma: PrismaService,
    ) {
        this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY')!, {
            apiVersion: '2026-04-22.dahlia' as any,
        });
    }

    private getPriceId(plan: 'PRO' | 'ENTERPRISE'): string {
        const prices = {
            PRO: this.config.get('STRIPE_PRO_PRICE_ID')!,
            ENTERPRISE: this.config.get('STRIPE_ENTERPRISE_PRICE_ID')!,
        };
        return prices[plan];
    }

    async createCheckoutSession(userId: string, plan: 'PRO' | 'ENTERPRISE') {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true },
        });

        if (!user?.organization) {
            throw new NotFoundException('You are not part of any organization');
        }

        const org = user.organization;
        let stripeCustomerId = org.stripeCustomerId;

        if (!stripeCustomerId) {
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: org.name,
                metadata: { organizationId: org.id },
            });
            stripeCustomerId = customer.id;

            await this.prisma.organization.update({
                where: { id: org.id },
                data: { stripeCustomerId },
            });
        }

        const session = await this.stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: this.getPriceId(plan), quantity: 1 }],
            success_url: `${this.config.get('FRONTEND_URL')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${this.config.get('FRONTEND_URL')}/billing/cancel`,
            metadata: { organizationId: org.id, plan },
        });

        return { url: session.url };
    }

    async createBillingPortal(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true },
        });

        if (!user?.organization?.stripeCustomerId) {
            throw new BadRequestException('No billing account found');
        }

        const session = await this.stripe.billingPortal.sessions.create({
            customer: user.organization.stripeCustomerId,
            return_url: `${this.config.get('FRONTEND_URL')}/dashboard`,
        });

        return { url: session.url };
    }

    async getSubscription(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true },
        });

        if (!user?.organization) {
            throw new NotFoundException('Organization not found');
        }

        return {
            plan: user.organization.plan,
            stripeSubscriptionId: user.organization.stripeSubscriptionId,
            currentPeriodEnd: user.organization.stripeCurrentPeriodEnd,
        };
    }
}