import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.INTEGRATION_BASE_URL || 'http://localhost:8787';

/**
 * Integration tests for Query endpoints
 *
 * Run with: INTEGRATION_BASE_URL=http://localhost:8787 npm run test:integration
 */

test('Query Endpoints', async (t) => {
  // Create a test user first
  const testUser = {
    email: `queries-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Queries Test User',
  };

  let sessionCookie = '';
  let teamId = '';
  let folderId = '';
  let queryId = '';

  await t.test('setup: register test user', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    assert.equal(res.status, 200);
    sessionCookie = res.headers.get('set-cookie').split(';')[0];
  });

  await t.test('setup: get user team', async () => {
    const res = await fetch(`${baseUrl}/teams`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(res.status, 200);
    const teams = await res.json();
    assert.ok(teams.length > 0);
    teamId = teams[0].id;
  });

  await t.test('POST /folders creates a new folder', async () => {
    const res = await fetch(`${baseUrl}/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        teamId,
        name: 'Integration Test Folder',
        description: 'Test folder for integration tests',
      }),
    });

    assert.equal(res.status, 200);
    const folder = await res.json();
    assert.equal(folder.name, 'Integration Test Folder');
    folderId = folder.id;
  });

  await t.test('GET /folders returns folders for team', async () => {
    const res = await fetch(`${baseUrl}/folders?teamId=${teamId}`, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const folders = await res.json();
    assert.ok(Array.isArray(folders));
    assert.ok(folders.length > 0);
    assert.ok(folders.some((f) => f.id === folderId));
  });

  await t.test('POST /queries creates a new query', async () => {
    const res = await fetch(`${baseUrl}/queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        teamId,
        folderId,
        title: 'Integration Test Query',
        sql: 'SELECT 1 AS test;',
      }),
    });

    assert.equal(res.status, 200);
    const query = await res.json();
    assert.equal(query.title, 'Integration Test Query');
    assert.equal(query.status, 'draft');
    queryId = query.id;
  });

  await t.test('GET /queries returns queries for team', async () => {
    const res = await fetch(`${baseUrl}/queries?teamId=${teamId}`, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const queries = await res.json();
    assert.ok(Array.isArray(queries));
    assert.ok(queries.some((q) => q.id === queryId));
  });

  await t.test('GET /queries/:id returns query details', async () => {
    const res = await fetch(`${baseUrl}/queries/${queryId}`, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const query = await res.json();
    assert.equal(query.id, queryId);
    assert.equal(query.title, 'Integration Test Query');
    assert.equal(query.sql, 'SELECT 1 AS test;');
  });

  await t.test('PUT /queries/:id updates a query', async () => {
    const res = await fetch(`${baseUrl}/queries/${queryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        title: 'Updated Test Query',
        sql: 'SELECT 2 AS updated_test;',
      }),
    });

    assert.equal(res.status, 200);
    const query = await res.json();
    assert.equal(query.title, 'Updated Test Query');
    assert.equal(query.sql, 'SELECT 2 AS updated_test;');
  });

  await t.test('POST /queries/:id/submit submits query for approval', async () => {
    const res = await fetch(`${baseUrl}/queries/${queryId}/submit`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const query = await res.json();
    // Solo user should auto-approve
    assert.ok(['approved', 'pending_approval'].includes(query.status));
  });

  await t.test('GET /queries/:id/history returns version history', async () => {
    const res = await fetch(`${baseUrl}/queries/${queryId}/history`, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
    const history = await res.json();
    assert.ok(Array.isArray(history));
    // Should have at least one version
    assert.ok(history.length >= 1);
  });

  await t.test('DELETE /queries/:id deletes a query', async () => {
    const res = await fetch(`${baseUrl}/queries/${queryId}`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);

    // Verify deletion
    const getRes = await fetch(`${baseUrl}/queries/${queryId}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(getRes.status, 404);
  });

  await t.test('DELETE /folders/:id deletes a folder', async () => {
    const res = await fetch(`${baseUrl}/folders/${folderId}`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });

    assert.equal(res.status, 200);
  });

  await t.test('GET /queries requires authentication', async () => {
    const res = await fetch(`${baseUrl}/queries?teamId=${teamId}`);
    assert.equal(res.status, 401);
  });

  await t.test('GET /queries requires teamId', async () => {
    const res = await fetch(`${baseUrl}/queries`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(res.status, 400);
  });
});

test('Query Validation', async (t) => {
  const testUser = {
    email: `query-validation-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Validation Test User',
  };

  let sessionCookie = '';
  let teamId = '';
  let folderId = '';

  await t.test('setup', async () => {
    // Register user
    const registerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    sessionCookie = registerRes.headers.get('set-cookie').split(';')[0];

    // Get team
    const teamsRes = await fetch(`${baseUrl}/teams`, {
      headers: { Cookie: sessionCookie },
    });
    const teams = await teamsRes.json();
    teamId = teams[0].id;

    // Create folder
    const folderRes = await fetch(`${baseUrl}/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        teamId,
        name: 'Validation Test Folder',
      }),
    });
    const folder = await folderRes.json();
    folderId = folder.id;
  });

  await t.test('POST /queries rejects empty title', async () => {
    const res = await fetch(`${baseUrl}/queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        teamId,
        folderId,
        title: '',
        sql: 'SELECT 1;',
      }),
    });

    assert.equal(res.status, 400);
  });

  await t.test('POST /queries rejects missing teamId', async () => {
    const res = await fetch(`${baseUrl}/queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        folderId,
        title: 'Test Query',
        sql: 'SELECT 1;',
      }),
    });

    assert.equal(res.status, 400);
  });

  await t.test('POST /queries rejects invalid teamId', async () => {
    const res = await fetch(`${baseUrl}/queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        teamId: 'not-a-valid-uuid',
        folderId,
        title: 'Test Query',
        sql: 'SELECT 1;',
      }),
    });

    assert.ok([400, 403, 404].includes(res.status));
  });
});

test('Query Authorization', async (t) => {
  // Create two users
  const user1 = {
    email: `auth-user1-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Auth User 1',
  };
  const user2 = {
    email: `auth-user2-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Auth User 2',
  };

  let cookie1 = '';
  let cookie2 = '';
  let team1Id = '';
  let folder1Id = '';
  let query1Id = '';

  await t.test('setup: create two users with separate teams', async () => {
    // User 1
    const res1 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user1),
    });
    cookie1 = res1.headers.get('set-cookie').split(';')[0];

    const teams1 = await (
      await fetch(`${baseUrl}/teams`, { headers: { Cookie: cookie1 } })
    ).json();
    team1Id = teams1[0].id;

    // Create folder for user 1
    const folderRes = await fetch(`${baseUrl}/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie1,
      },
      body: JSON.stringify({ teamId: team1Id, name: 'User 1 Folder' }),
    });
    const folder = await folderRes.json();
    folder1Id = folder.id;

    // Create query for user 1
    const queryRes = await fetch(`${baseUrl}/queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie1,
      },
      body: JSON.stringify({
        teamId: team1Id,
        folderId: folder1Id,
        title: 'User 1 Query',
        sql: 'SELECT 1;',
      }),
    });
    const query = await queryRes.json();
    query1Id = query.id;

    // User 2
    const res2 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user2),
    });
    cookie2 = res2.headers.get('set-cookie').split(';')[0];
  });

  await t.test('user cannot access another users query', async () => {
    const res = await fetch(`${baseUrl}/queries/${query1Id}`, {
      headers: { Cookie: cookie2 },
    });
    // Should be forbidden or not found
    assert.ok([403, 404].includes(res.status));
  });

  await t.test('user cannot update another users query', async () => {
    const res = await fetch(`${baseUrl}/queries/${query1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie2,
      },
      body: JSON.stringify({
        title: 'Hacked Query',
        sql: 'DROP TABLE users;',
      }),
    });
    assert.ok([403, 404].includes(res.status));
  });

  await t.test('user cannot delete another users query', async () => {
    const res = await fetch(`${baseUrl}/queries/${query1Id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie2 },
    });
    assert.ok([403, 404].includes(res.status));
  });

  await t.test('user cannot access another users folder', async () => {
    const res = await fetch(`${baseUrl}/folders/${folder1Id}`, {
      headers: { Cookie: cookie2 },
    });
    assert.ok([403, 404].includes(res.status));
  });
});
