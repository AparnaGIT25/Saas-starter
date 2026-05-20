import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = 'http://127.0.0.1:4000/auth';

async function registerUser(email, password, role) {
    console.log(`\n--- Registering & Setting up ${role} ---`);
    // 1. Register (gets MEMBER by default)
    try {
        const regRes = await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name: `${role} User` })
        });
        const regData = await regRes.json();
        
        if (!regRes.ok && regData.message !== 'Email already in use') {
            console.error('Registration failed:', regData);
            return null;
        }

        // 2. Force the role in the database using Prisma
        await prisma.user.update({
            where: { email },
            data: { role }
        });
        console.log(`Database updated: ${email} is now ${role}`);

        // 3. Login to get a fresh token with the new role
        const loginRes = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json();
        return loginData.access_token;
    } catch (err) {
        console.error('Error setting up user:', err);
    }
}

async function testEndpoint(endpoint, method, token, roleName) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json().catch(() => null);
    
    if (res.ok) {
        console.log(`✅ [${roleName}] ${method} ${endpoint} -> Success! (Msg: ${data?.message})`);
    } else {
        console.log(`❌ [${roleName}] ${method} ${endpoint} -> Failed: ${res.status} ${data?.message || res.statusText}`);
    }
}

async function runTests() {
    console.log('Starting Role-Based Access Control Tests...\n');

    // Setup Users & Get Tokens
    const memberToken = await registerUser('member@test.com', 'password', 'MEMBER');
    const adminToken = await registerUser('admin@test.com', 'password', 'ADMIN');
    const ownerToken = await registerUser('owner@test.com', 'password', 'OWNER');

    console.log('\n--- Running Tests for MEMBER ---');
    await testEndpoint('/dashboard', 'GET', memberToken, 'MEMBER');
    await testEndpoint('/admin-panel', 'GET', memberToken, 'MEMBER');
    await testEndpoint('/organization', 'DELETE', memberToken, 'MEMBER');

    console.log('\n--- Running Tests for ADMIN ---');
    await testEndpoint('/dashboard', 'GET', adminToken, 'ADMIN');
    await testEndpoint('/admin-panel', 'GET', adminToken, 'ADMIN');
    await testEndpoint('/organization', 'DELETE', adminToken, 'ADMIN');

    console.log('\n--- Running Tests for OWNER ---');
    await testEndpoint('/dashboard', 'GET', ownerToken, 'OWNER');
    await testEndpoint('/admin-panel', 'GET', ownerToken, 'OWNER');
    await testEndpoint('/organization', 'DELETE', ownerToken, 'OWNER');

    await prisma.$disconnect();
}

runTests();
