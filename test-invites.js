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

  // User 1
  const email1 = `owner-${Date.now()}@example.com`;
  const password = 'password123';
  
  let res = await request('POST', '/auth/register', { email: email1, password, name: 'Owner User' });
  results.push({ step: 'Registering Owner', status: res.status, data: res.data });

  res = await request('POST', '/auth/login', { email: email1, password });
  const token1 = res.data?.access_token;

  // Create Org
  const orgSlug = `org-${Date.now()}`;
  res = await request('POST', '/organizations', { name: 'My Test Org', slug: orgSlug }, token1);
  results.push({ step: 'Creating Organization', status: res.status, data: res.data });

  // Send Invite to User 2
  const email2 = `invited-${Date.now()}@example.com`;
  res = await request('POST', '/invites', { email: email2, role: 'MEMBER' }, token1);
  results.push({ step: 'Sending Invite', status: res.status, data: res.data });

  // Get Org Invites
  res = await request('GET', '/invites', null, token1);
  results.push({ step: 'Listing Pending Invites', status: res.status, data: res.data });

  // User 2
  res = await request('POST', '/auth/register', { email: email2, password, name: 'Invited User' });
  results.push({ step: 'Registering Invited User', status: res.status, data: res.data });

  res = await request('POST', '/auth/login', { email: email2, password });
  const token2 = res.data?.access_token;

  // Fetch token from DB for testing
  const inviteInDb = await prisma.invite.findFirst({ where: { email: email2 } });
  
  if (inviteInDb) {
      // Accept Invite
      res = await request('POST', '/invites/accept', { token: inviteInDb.token }, token2);
      results.push({ step: 'Accepting Invite', status: res.status, data: res.data });

      // Check if User 2 is now in org
      res = await request('GET', '/organizations/me', null, token2);
      results.push({ step: 'Checking User 2 Organization', status: res.status, data: res.data });
  } else {
      results.push({ step: 'Accepting Invite', status: 500, error: 'Could not find invite in DB to get token' });
  }

  fs.writeFileSync('test-invites-result.json', JSON.stringify(results, null, 2));
  console.log('Test completed! Check test-invites-result.json');
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  fs.writeFileSync('test-invites-result.json', JSON.stringify({ error: e.message }));
  console.error(e);
});
