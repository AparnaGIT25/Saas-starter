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

  // 1. Setup Users & Orgs
  // Owner 1
  let res = await request('POST', '/auth/register', { email: `owner1-${ts}@test.com`, password: pwd, name: 'Owner 1' });
  res = await request('POST', '/auth/login', { email: `owner1-${ts}@test.com`, password: pwd });
  const tokenOwner1 = res.data.access_token;
  await request('POST', '/organizations', { name: 'Org 1', slug: `org1-${ts}` }, tokenOwner1);

  // Owner 2
  res = await request('POST', '/auth/register', { email: `owner2-${ts}@test.com`, password: pwd, name: 'Owner 2' });
  res = await request('POST', '/auth/login', { email: `owner2-${ts}@test.com`, password: pwd });
  const tokenOwner2 = res.data.access_token;
  await request('POST', '/organizations', { name: 'Org 2', slug: `org2-${ts}` }, tokenOwner2);

  // User A
  const emailA = `usera-${ts}@test.com`;
  res = await request('POST', '/auth/register', { email: emailA, password: pwd, name: 'User A' });
  res = await request('POST', '/auth/login', { email: emailA, password: pwd });
  const tokenA = res.data.access_token;

  // User B
  const emailB = `userb-${ts}@test.com`;
  res = await request('POST', '/auth/register', { email: emailB, password: pwd, name: 'User B' });
  res = await request('POST', '/auth/login', { email: emailB, password: pwd });
  const tokenB = res.data.access_token;

  // User C
  const emailC = `userc-${ts}@test.com`;
  res = await request('POST', '/auth/register', { email: emailC, password: pwd, name: 'User C' });
  res = await request('POST', '/auth/login', { email: emailC, password: pwd });
  const tokenC = res.data.access_token;

  // ---------------------------------------------------------
  // Test 1: Pending invite exists → 409 Conflict
  // ---------------------------------------------------------
  await request('POST', '/invites', { email: emailB, role: 'MEMBER' }, tokenOwner1);
  res = await request('POST', '/invites', { email: emailB, role: 'MEMBER' }, tokenOwner1);
  results.push({ step: 'Pending invite exists', expected: 409, actual: res.status, passed: res.status === 409, data: res.data });

  // ---------------------------------------------------------
  // Test 2: Invalid token → 404 Not Found
  // ---------------------------------------------------------
  res = await request('POST', '/invites/accept', { token: 'invalid_token_123' }, tokenA);
  results.push({ step: 'Invalid token', expected: 404, actual: res.status, passed: res.status === 404, data: res.data });

  // ---------------------------------------------------------
  // Test 3: Wrong email → 403 Forbidden
  // ---------------------------------------------------------
  const inviteB = await prisma.invite.findFirst({ where: { email: emailB } });
  res = await request('POST', '/invites/accept', { token: inviteB.token }, tokenC); // User C tries to accept User B's token
  results.push({ step: 'Wrong email', expected: 403, actual: res.status, passed: res.status === 403, data: res.data });

  // ---------------------------------------------------------
  // Test 4: Token expired → 410 Gone
  // ---------------------------------------------------------
  // Owner 1 invites User C
  await request('POST', '/invites', { email: emailC, role: 'MEMBER' }, tokenOwner1);
  const inviteC = await prisma.invite.findFirst({ where: { email: emailC, acceptedAt: null } });
  
  // Set expiry to past manually
  await prisma.invite.update({
      where: { id: inviteC.id },
      data: { expiresAt: new Date(Date.now() - 100000) }
  });

  res = await request('POST', '/invites/accept', { token: inviteC.token }, tokenC);
  results.push({ step: 'Token expired', expected: 410, actual: res.status, passed: res.status === 410, data: res.data });

  // ---------------------------------------------------------
  // Setup for next tests: User A joins Org 1
  // ---------------------------------------------------------
  await request('POST', '/invites', { email: emailA, role: 'MEMBER' }, tokenOwner1);
  const inviteA = await prisma.invite.findFirst({ where: { email: emailA } });
  await request('POST', '/invites/accept', { token: inviteA.token }, tokenA);

  // ---------------------------------------------------------
  // Test 5: Already a member → 409 Conflict
  // ---------------------------------------------------------
  res = await request('POST', '/invites', { email: emailA, role: 'MEMBER' }, tokenOwner1);
  results.push({ step: 'Already a member', expected: 409, actual: res.status, passed: res.status === 409, data: res.data });

  // ---------------------------------------------------------
  // Test 6: Already accepted → 400 Bad Request
  // ---------------------------------------------------------
  // User A tries to accept the same token again
  res = await request('POST', '/invites/accept', { token: inviteA.token }, tokenA);
  results.push({ step: 'Already accepted', expected: 400, actual: res.status, passed: res.status === 400, data: res.data });

  // ---------------------------------------------------------
  // Test 7: Already in org → 409 Conflict
  // ---------------------------------------------------------
  // Owner 2 sends invite to User A (who is already in Org 1)
  await request('POST', '/invites', { email: emailA, role: 'MEMBER' }, tokenOwner2);
  const inviteA2 = await prisma.invite.findFirst({ where: { email: emailA, organizationId: { not: inviteA.organizationId } } });
  
  res = await request('POST', '/invites/accept', { token: inviteA2.token }, tokenA);
  results.push({ step: 'Already in org', expected: 409, actual: res.status, passed: res.status === 409, data: res.data });

  fs.writeFileSync('test-edge-cases.json', JSON.stringify(results, null, 2));
  console.log('Edge cases test completed! Check test-edge-cases.json');
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  fs.writeFileSync('test-edge-cases.json', JSON.stringify({ error: e.message }));
  console.error(e);
});
