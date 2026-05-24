import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
const Stripe = require('stripe');

@Injectable()
export class BillingService {
  private stripe: any;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-04-10',
    });
  }

  // ─────────────────────────────────────────
  // Map our Plan enum to Stripe Price IDs
  // ─────────────────────────────────────────
  private getPriceId(plan: 'PRO' | 'ENTERPRISE'): string {
    const prices: Record<string, string> = {
      PRO: this.config.get('STRIPE_PRO_PRICE_ID')!,
      ENTERPRISE: this.config.get('STRIPE_ENTERPRISE_PRICE_ID')!,
    };
    return prices[plan];
  }

  // ─────────────────────────────────────────
  // Create Stripe Checkout Session
  // ─────────────────────────────────────────
  async createCheckoutSession(orgId: string, plan: 'PRO' | 'ENTERPRISE') {
    // 1. Get org
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // 2. Get or create Stripe customer for this org
    let stripeCustomerId = org.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        name: org.name,
        metadata: { organizationId: org.id },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to DB so we never create duplicates
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId },
      });
    }

    // 3. Create the checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: this.getPriceId(plan), quantity: 1 }],
      success_url: `${this.config.get('FRONTEND_URL')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.config.get('FRONTEND_URL')}/billing/cancel`,
      metadata: {
        organizationId: org.id,
        plan,
      },
    });

    return { url: session.url };
  }

  // ─────────────────────────────────────────
  // Create Stripe Billing Portal
  // ─────────────────────────────────────────
  async createBillingPortal(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org?.stripeCustomerId) {
      throw new BadRequestException(
        'No billing account found. Please subscribe first.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${this.config.get('FRONTEND_URL')}/dashboard`,
    });

    return { url: session.url };
  }

  // ─────────────────────────────────────────
  // Get Current Subscription Details
  // ─────────────────────────────────────────
  async getSubscription(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return {
      plan: org.plan,
      stripeSubscriptionId: org.stripeSubscriptionId,
      currentPeriodEnd: org.stripeCurrentPeriodEnd,
    };
  }

  // ─────────────────────────────────────────
  // Handle Incoming Stripe Webhook
  // ─────────────────────────────────────────
  async handleWebhook(signature: string, rawBody: Buffer) {
    let event: any;

    try {
      // Verify the webhook actually came from Stripe
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.get('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err.message}`,
      );
    }

    // Route to correct handler based on event type
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    // Always return 200 to Stripe
    // If you return an error, Stripe will retry the webhook
    return { received: true };
  }

  // ─────────────────────────────────────────
  // Checkout Completed → Upgrade Plan
  // ─────────────────────────────────────────
  private async handleCheckoutCompleted(session: any) {
    const organizationId = session.metadata?.organizationId;
    const plan = session.metadata?.plan;

    if (!organizationId || !plan) {
      console.log('Missing metadata in checkout session');
      return;
    }

    // Get subscription details from Stripe
    const subscription = await this.stripe.subscriptions.retrieve(
      session.subscription,
    );

    // Update org in our database
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: plan,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        stripeCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ),
      },
    });

    console.log(`✅ Organization ${organizationId} upgraded to ${plan}`);
  }

  // ─────────────────────────────────────────
  // Subscription Updated → Sync Plan
  // ─────────────────────────────────────────
  private async handleSubscriptionUpdated(subscription: any) {
    // Find org by subscription ID
    const org = await this.prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!org) {
      console.log(`No org found for subscription ${subscription.id}`);
      return;
    }

    // Determine new plan from price ID
    const priceId = subscription.items.data[0].price.id;
    let plan: 'FREE' | 'PRO' | 'ENTERPRISE' = 'FREE';

    if (priceId === this.config.get('STRIPE_PRO_PRICE_ID')) {
      plan = 'PRO';
    } else if (priceId === this.config.get('STRIPE_ENTERPRISE_PRICE_ID')) {
      plan = 'ENTERPRISE';
    }

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        plan,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ),
      },
    });

    console.log(`🔄 Organization ${org.id} plan synced to ${plan}`);
  }

  // ─────────────────────────────────────────
  // Subscription Deleted → Downgrade to FREE
  // ─────────────────────────────────────────
  private async handleSubscriptionDeleted(subscription: any) {
    const org = await this.prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!org) {
      console.log(`No org found for subscription ${subscription.id}`);
      return;
    }

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        plan: 'FREE',
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    });

    console.log(`⬇️ Organization ${org.id} downgraded to FREE`);
  }

  // ─────────────────────────────────────────
  // Payment Failed → Log & Alert
  // ─────────────────────────────────────────
  private async handlePaymentFailed(invoice: any) {
    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: invoice.customer },
    });

    if (!org) {
      console.log(`No org found for customer ${invoice.customer}`);
      return;
    }

    // In production: send email to org owner warning about failed payment
    // For now we just log it
    console.log(
      `❌ Payment failed for organization ${org.id}. Invoice: ${invoice.id}`,
    );
  }
}
