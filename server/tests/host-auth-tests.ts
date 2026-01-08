const BASE_URL = 'http://localhost:5000';

async function testHostAuth() {
    console.log('\n🔐 HOST AUTHENTICATION TESTS\n');
    
    const testEmail = `qa-test-${Date.now()}@test.com`;
    const testPassword = 'TestPassword123!';
    let authToken = '';

    // =========================================================================
    // SIGNUP TESTS
    // =========================================================================

    console.log('1. Testing signup with valid data...');
    let res = await fetch(`${BASE_URL}/api/host/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            firstName: 'QA',
            lastName: 'Tester',
            phone: '555-123-4567',
            businessName: 'QA Testing Inc',
            businessType: 'company'
        })
    });
    let data = await res.json() as any;
    console.log(res.ok ? '✅ Signup successful' : `❌ Signup failed: ${data.error}`);

    console.log('\n2. Testing signup with duplicate email...');
    res = await fetch(`${BASE_URL}/api/host/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            firstName: 'Duplicate',
            lastName: 'User'
        })
    });
    data = await res.json() as any;
    console.log(res.status === 400 ? '✅ Correctly rejected duplicate email' : `❌ Should reject duplicate (got ${res.status})`);

    console.log('\n3. Testing signup with weak password...');
    res = await fetch(`${BASE_URL}/api/host/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'weak-password@test.com',
            password: '123',  // Too short
            firstName: 'Weak',
            lastName: 'Pass'
        })
    });
    data = await res.json() as any;
    console.log(res.status === 400 ? '✅ Correctly rejected weak password' : `❌ Should reject weak password (got ${res.status})`);

    console.log('\n4. Testing signup with missing required fields...');
    res = await fetch(`${BASE_URL}/api/host/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'missing-fields@test.com'
            // Missing password, firstName, lastName
        })
    });
    data = await res.json() as any;
    console.log(res.status === 400 ? '✅ Correctly rejected missing fields' : `❌ Should reject missing fields (got ${res.status})`);

    console.log('\n5. Testing signup with invalid email format...');
    res = await fetch(`${BASE_URL}/api/host/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'not-an-email',
            password: testPassword,
            firstName: 'Bad',
            lastName: 'Email'
        })
    });
    data = await res.json() as any;
    console.log(res.status === 400 ? '✅ Correctly rejected invalid email' : `⚠️ May want to validate email format (got ${res.status})`);

    // =========================================================================
    // LOGIN TESTS
    // =========================================================================

    console.log('\n6. Testing login with correct credentials...');
    res = await fetch(`${BASE_URL}/api/host/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testEmail,
            password: testPassword
        })
    });
    data = await res.json() as any;
    if (res.ok && data.token) {
        authToken = data.token;
        console.log('✅ Login successful, token received');
    } else {
        console.log(`❌ Login failed: ${data.error}`);
    }

    console.log('\n7. Testing login with wrong password...');
    res = await fetch(`${BASE_URL}/api/host/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testEmail,
            password: 'WrongPassword123!'
        })
    });
    data = await res.json() as any;
    console.log(res.status === 401 ? '✅ Correctly rejected wrong password' : `❌ Should reject wrong password (got ${res.status})`);

    console.log('\n8. Testing login with nonexistent email...');
    res = await fetch(`${BASE_URL}/api/host/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'nonexistent@test.com',
            password: testPassword
        })
    });
    data = await res.json() as any;
    console.log(res.status === 401 ? '✅ Correctly rejected nonexistent user' : `❌ Should reject nonexistent user (got ${res.status})`);

    console.log('\n9. Testing login with remember me...');
    res = await fetch(`${BASE_URL}/api/host/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            rememberMe: true
        })
    });
    data = await res.json() as any;
    console.log(res.ok ? '✅ Login with rememberMe successful' : `❌ Failed: ${data.error}`);
    if (data.token) authToken = data.token;

    // =========================================================================
    // PROTECTED ROUTE TESTS
    // =========================================================================

    console.log('\n10. Testing /me without token...');
    res = await fetch(`${BASE_URL}/api/host/auth/me`);
    console.log(res.status === 401 ? '✅ Correctly rejected unauthenticated request' : `❌ Should require auth (got ${res.status})`);

    console.log('\n11. Testing /me with valid token...');
    res = await fetch(`${BASE_URL}/api/host/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    data = await res.json() as any;
    if (res.ok && data.host) {
        console.log('✅ Got host data:', data.host.email);
    } else {
        console.log(`❌ Failed to get host data: ${data.error}`);
    }

    console.log('\n12. Testing /me with invalid token...');
    res = await fetch(`${BASE_URL}/api/host/auth/me`, {
        headers: { 'Authorization': 'Bearer invalid-token-12345' }
    });
    console.log(res.status === 401 ? '✅ Correctly rejected invalid token' : `❌ Should reject invalid token (got ${res.status})`);

    console.log('\n13. Testing /me with malformed auth header...');
    res = await fetch(`${BASE_URL}/api/host/auth/me`, {
        headers: { 'Authorization': 'NotBearer token' }
    });
    console.log(res.status === 401 ? '✅ Correctly rejected malformed header' : `❌ Should reject malformed header (got ${res.status})`);

    // =========================================================================
    // PASSWORD CHANGE TESTS
    // =========================================================================

    console.log('\n14. Testing password change with correct current password...');
    res = await fetch(`${BASE_URL}/api/host/auth/change-password`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            currentPassword: testPassword,
            newPassword: 'NewPassword456!'
        })
    });
    data = await res.json() as any;
    console.log(res.ok ? '✅ Password changed successfully' : `❌ Failed: ${data.error}`);

    console.log('\n15. Testing login with new password...');
    res = await fetch(`${BASE_URL}/api/host/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testEmail,
            password: 'NewPassword456!'
        })
    });
    data = await res.json() as any;
    console.log(res.ok ? '✅ Login with new password successful' : '❌ New password should work');
    if (data.token) authToken = data.token;

    console.log('\n16. Testing password change with wrong current password...');
    res = await fetch(`${BASE_URL}/api/host/auth/change-password`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            currentPassword: 'WrongCurrent123!',
            newPassword: 'AnotherNew789!'
        })
    });
    console.log(res.status === 400 ? '✅ Correctly rejected wrong current password' : `❌ Should reject (got ${res.status})`);

    // =========================================================================
    // LOGOUT TESTS
    // =========================================================================

    console.log('\n17. Testing logout...');
    res = await fetch(`${BASE_URL}/api/host/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    console.log(res.ok ? '✅ Logout successful' : `❌ Logout failed`);

    console.log('\n18. Testing /me with logged-out token...');
    res = await fetch(`${BASE_URL}/api/host/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    console.log(res.status === 401 ? '✅ Token correctly invalidated after logout' : `⚠️ Token may still be valid (got ${res.status})`);

    // =========================================================================
    // FORGOT PASSWORD TESTS
    // =========================================================================

    console.log('\n19. Testing forgot password with valid email...');
    res = await fetch(`${BASE_URL}/api/host/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail })
    });
    console.log(res.ok ? '✅ Forgot password request accepted' : `❌ Failed (got ${res.status})`);

    console.log('\n20. Testing forgot password with nonexistent email...');
    res = await fetch(`${BASE_URL}/api/host/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@nowhere.com' })
    });
    // Should return success to not reveal if email exists
    console.log(res.ok ? '✅ Correctly does not reveal email existence' : `⚠️ May be revealing email existence (got ${res.status})`);

    // =========================================================================
    // CLEANUP
    // =========================================================================

    console.log('\n🧹 Cleaning up test user...');
    // You may want to delete the test user from the database
    // DELETE FROM cc_host_accounts WHERE email LIKE 'qa-test-%@test.com';

    console.log('\n✅ HOST AUTH TESTS COMPLETE');
}

testHostAuth().catch(console.error);
