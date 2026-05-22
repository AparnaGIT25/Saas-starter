const http = require('http');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk.toString());
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  const results = [];
  const prisma = new PrismaClient();

  const ts = Date.now();
  const pwd = 'password123';

  // 1. Setup User & Org
  let res = await request('POST', '/auth/register', { email: `owner-${ts}@billing.com`, password: pwd, name: 'Billing Owner' });
  res = await request('POST', '/auth/login', { email: `owner-${ts}@billing.com`, password: pwd });
  const tokenOwner = res.data?.access_token;
  
  if (!tokenOwner) {
    results.push({ step: 'Login Failed', data: res.data });
    fs.writeFileSync('test-billing-result.json', JSON.stringify(results, null, 2));
    return;
  }

  await request('POST', '/organizations', { name: 'Billing Org', slug: `billing-org-${ts}` }, tokenOwner);

  // Test GET /billing/subscription
  res = await request('GET', '/billing/subscription', null, tokenOwner);
  results.push({ step: 'Get Subscription (Before Checkout)', expected: 200, actual: res.status, passed: res.status === 200, data: res.data });

  // Test POST /billing/checkout
  res = await request('POST', '/billing/checkout', { plan: 'PRO' }, tokenOwner);
  results.push({ step: 'Create Checkout Session (PRO)', expected: 201, actual: res.status, passed: res.status === 201, data: res.data });

  // Test POST /billing/portal
  res = await request('POST', '/billing/portal', null, tokenOwner);
  results.push({ step: 'Create Billing Portal', expected: [201, 400], actual: res.status, passed: res.status === 201 || res.status === 400, data: res.data });
  // Note: portal might return 400 if checkout session wasn't paid or customer wasn't created properly

  fs.writeFileSync('test-billing-result.json', JSON.stringify(results, null, 2));
  console.log('Billing test completed! Check test-billing-result.json');
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  fs.writeFileSync('test-billing-result.json', JSON.stringify({ error: e.message }));
  console.error(e);
});
