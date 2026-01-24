import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.INTEGRATION_BASE_URL || 'http://localhost:8787';

/**
 * Integration tests for Quorum SQL API
 *
 * Run with: INTEGRATION_BASE_URL=http://localhost:8787 npm run test:integration
 *
 * These tests verify API endpoints work correctly with a real database.
 */

test('Health Endpoints', async (t) => {
  await t.test('GET /health returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  });

  await t.test('GET /health/live returns ok', async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  });

  await t.test('GET /health/ready returns ok with database', async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.database, 'connected');
  });

  await t.test('GET /health/db returns database time', async () => {
    const res = await fetch(`${baseUrl}/health/db`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(data.now, 'should have timestamp');
  });
});

test('Auth Endpoints', async (t) => {
  const testUser = {
    email: `integration-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Integration Test User',
  };

  let sessionCookie = '';

  await t.test('POST /auth/register creates new user', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);

    // Save session cookie for subsequent tests
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'should set session cookie');
    sessionCookie = setCookie.split(';')[0];
  });

  await t.test('GET /auth/me returns current user', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.email, testUser.email.toLowerCase());
  });

  await t.test('POST /auth/logout clears session', async () => {
    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  });

  await t.test('POST /auth/login authenticates user', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);

    // Update session cookie
    const setCookie = res.headers.get('set-cookie');
    sessionCookie = setCookie.split(';')[0];
  });

  await t.test('POST /auth/register rejects duplicate email', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    assert.equal(res.status, 409);
  });

  await t.test('POST /auth/login rejects invalid password', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'WrongPassword123!',
      }),
    });

    assert.equal(res.status, 401);
  });
});

test('Teams Endpoints', async (t) => {
  // Create a test user first
  const testUser = {
    email: `teams-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Teams Test User',
  };

  let sessionCookie = '';
  let teamId = '';

  await t.test('setup: register test user', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    assert.equal(res.status, 200);
    sessionCookie = res.headers.get('set-cookie').split(';')[0];
  });

  await t.test('GET /teams returns user teams', async () => {
    const res = await fetch(`${baseUrl}/teams`, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data), 'should return array');
    // New user should have a personal workspace
    assert.ok(data.length >= 1, 'should have at least one team');

    // Save the first team ID for later tests
    teamId = data[0].id;
  });

  await t.test('POST /teams creates new team', async () => {
    const res = await fetch(`${baseUrl}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        name: 'Integration Test Team',
        approval_quota: 2,
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, 'Integration Test Team');
    assert.equal(data.approval_quota, 2);
  });

  await t.test('GET /teams/:id returns team details', async () => {
    const res = await fetch(`${baseUrl}/teams/${teamId}`, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, teamId);
  });

  await t.test('GET /teams requires authentication', async () => {
    const res = await fetch(`${baseUrl}/teams`);
    assert.equal(res.status, 401);
  });
});

test('Unauthenticated Endpoints', async (t) => {
  await t.test('GET /auth/me returns null without session', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data, null);
  });

  await t.test('GET /teams returns 401 without session', async () => {
    const res = await fetch(`${baseUrl}/teams`);
    assert.equal(res.status, 401);
  });

  await t.test('GET /queries returns 401 without session', async () => {
    const res = await fetch(`${baseUrl}/queries?teamId=123`);
    assert.equal(res.status, 401);
  });
});
