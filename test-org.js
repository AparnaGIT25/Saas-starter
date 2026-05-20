const http = require('http');
const fs = require('fs');

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
  const email = `test-${Date.now()}@example.com`;
  const password = 'password123';
  const name = 'Test User';

  let res = await request('POST', '/auth/register', { email, password, name });
  results.push({ step: 'Registering user', status: res.status, data: res.data });

  res = await request('POST', '/auth/login', { email, password });
  results.push({ step: 'Logging in', status: res.status, data: res.data });
  const token = res.data?.access_token;
  if (!token) {
    fs.writeFileSync('result.json', JSON.stringify(results, null, 2));
    return;
  }

  const orgSlug = `org-${Date.now()}`;
  res = await request('POST', '/organizations', { name: 'My Test Org', slug: orgSlug }, token);
  results.push({ step: 'Creating Organization', status: res.status, data: res.data });

  res = await request('GET', '/organizations/me', null, token);
  results.push({ step: 'Getting My Organization', status: res.status, data: res.data });

  res = await request('PATCH', '/organizations/me', { name: 'Updated Org Name' }, token);
  results.push({ step: 'Updating My Organization', status: res.status, data: res.data });

  res = await request('GET', '/organizations/members', null, token);
  results.push({ step: 'Getting Organization Members', status: res.status, data: res.data });
  
  const members = res.data;
  if (Array.isArray(members) && members.length > 0) {
    const owner = members.find(m => m.role === 'OWNER');
    if (owner) {
        res = await request('DELETE', `/organizations/members/${owner.id}`, null, token);
        results.push({ step: 'Trying to remove OWNER (should fail)', status: res.status, data: res.data });
    }
  }

  fs.writeFileSync('result.json', JSON.stringify(results, null, 2));
}

runTests().catch(e => {
  fs.writeFileSync('result.json', JSON.stringify({ error: e.message }));
});
