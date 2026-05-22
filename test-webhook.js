require('dotenv').config();
const http = require('http');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
const prisma = new PrismaClient();
const PORT = 3001; // user updated main.ts to 3001

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        ...headers
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk.toString());
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runTests() {
  const results = [];
  const ts = Date.now();
  
  console.log('Setting up mock organization...');
  // Setup Org directly in DB for speed
  const org = await prisma.organization.create({
      data: {
          name: 'Webhook Test Org',
          slug: `webhook-org-${ts}`,
          plan: 'PRO',
          stripeSubscriptionId: `sub_test_${ts}`,
          stripeCustomerId: `cus_test_${ts}`,
      }
  });

  const payload = {
      id: 'evt_test_webhook',
      type: 'customer.subscription.deleted',
      object: 'event',
      data: {
          object: {
              id: org.stripeSubscriptionId,
              customer: org.stripeCustomerId
          }
      }
  };

  const payloadString = JSON.stringify(payload, null, 2);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // 1. Test invalid signature
  console.log('Testing invalid signature...');
  let res = await request('POST', '/billing/webhook', payloadString, {
      'Content-Type': 'application/json',
      'stripe-signature': 't=123,v1=invalid_signature'
  });
  results.push({ step: 'Invalid Signature', expected: 400, actual: res.status, passed: res.status === 400, response: res.data });

  // 2. Test valid signature
  console.log('Testing valid signature...');
  const validSignature = stripe.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret,
  });

  res = await request('POST', '/billing/webhook', payloadString, {
      'Content-Type': 'application/json',
      'stripe-signature': validSignature
  });
  results.push({ step: 'Valid Signature (Subscription Deleted)', expected: 201, actual: res.status, passed: res.status === 201, response: res.data });

  // 3. Verify Org was downgraded
  console.log('Verifying downgrade in DB...');
  const updatedOrg = await prisma.organization.findUnique({ where: { id: org.id } });
  const downgraded = updatedOrg.plan === 'FREE' && updatedOrg.stripeSubscriptionId === null;
  results.push({ step: 'Verify Downgrade to FREE', expected: true, actual: downgraded, passed: downgraded });

  fs.writeFileSync('test-webhook-result.json', JSON.stringify(results, null, 2));
  console.log('Webhook tests completed! Check test-webhook-result.json');
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  fs.writeFileSync('test-webhook-result.json', JSON.stringify({ error: e.message }));
  console.error(e);
});
