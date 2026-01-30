import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.INTEGRATION_BASE_URL || 'http://localhost:8787';

/**
 * Integration tests for Invitation endpoints
 *
 * Run with: INTEGRATION_BASE_URL=http://localhost:8787 npm run test:integration
 */

test('Invitation Endpoints', async (t) => {
  const adminUser = {
    email: `invite-admin-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Invite Admin User',
  };

  const invitedUser = {
    email: `invited-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Invited User',
  };

  let adminCookie = '';
  let invitedCookie = '';
  let teamId = '';
  let invitationId = '';

  await t.test('setup: register admin user', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminUser),
    });
    assert.equal(res.status, 200);
    adminCookie = res.headers.get('set-cookie').split(';')[0];

    // Get team
    const teamsRes = await fetch(`${baseUrl}/teams`, {
      headers: { Cookie: adminCookie },
    });
    const teams = await teamsRes.json();
    teamId = teams[0].id;
  });

  await t.test('POST /invites creates invitation', async () => {
    const res = await fetch(`${baseUrl}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        teamId,
        email: invitedUser.email,
        role: 'member',
      }),
    });

    assert.equal(res.status, 200);
    const invitation = await res.json();
    assert.equal(invitation.invited_email, invitedUser.email.toLowerCase());
    assert.equal(invitation.status, 'pending');
    invitationId = invitation.id;
  });

  await t.test('GET /invites/team/:teamId returns team invitations', async () => {
    const res = await fetch(`${baseUrl}/invites/team/${teamId}`, {
      headers: { Cookie: adminCookie },
    });

    assert.equal(res.status, 200);
    const invitations = await res.json();
    assert.ok(Array.isArray(invitations));
    assert.ok(invitations.some((i) => i.id === invitationId));
  });

  await t.test('POST /invites rejects duplicate invitation', async () => {
    const res = await fetch(`${baseUrl}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        teamId,
        email: invitedUser.email,
        role: 'member',
      }),
    });

    // Should reject duplicate
    assert.ok([400, 409].includes(res.status));
  });

  await t.test('setup: register invited user', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invitedUser),
    });
    assert.equal(res.status, 200);
    invitedCookie = res.headers.get('set-cookie').split(';')[0];
  });

  await t.test('GET /invites/mine returns pending invitations for user', async () => {
    const res = await fetch(`${baseUrl}/invites/mine`, {
      headers: { Cookie: invitedCookie },
    });

    assert.equal(res.status, 200);
    const invitations = await res.json();
    assert.ok(Array.isArray(invitations));
    assert.ok(invitations.some((i) => i.id === invitationId));
  });

  await t.test('POST /invites/:id/accept accepts invitation', async () => {
    const res = await fetch(`${baseUrl}/invites/${invitationId}/accept`, {
      method: 'POST',
      headers: { Cookie: invitedCookie },
    });

    assert.equal(res.status, 200);
    const result = await res.json();
    assert.equal(result.ok, true);
  });

  await t.test('user is now a member of the team', async () => {
    const res = await fetch(`${baseUrl}/teams`, {
      headers: { Cookie: invitedCookie },
    });

    assert.equal(res.status, 200);
    const teams = await res.json();
    assert.ok(teams.some((t) => t.id === teamId));
  });

  await t.test('GET /invites/mine returns empty after acceptance', async () => {
    const res = await fetch(`${baseUrl}/invites/mine`, {
      headers: { Cookie: invitedCookie },
    });

    assert.equal(res.status, 200);
    const invitations = await res.json();
    // Should not have any pending invitations to this team
    assert.ok(!invitations.some((i) => i.team_id === teamId && i.status === 'pending'));
  });
});

test('Invitation Decline Flow', async (t) => {
  const adminUser = {
    email: `decline-admin-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Decline Admin User',
  };

  const declineUser = {
    email: `decline-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Decline User',
  };

  let adminCookie = '';
  let declineCookie = '';
  let teamId = '';
  let invitationId = '';

  await t.test('setup', async () => {
    // Admin
    const adminRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminUser),
    });
    adminCookie = adminRes.headers.get('set-cookie').split(';')[0];

    const teamsRes = await fetch(`${baseUrl}/teams`, {
      headers: { Cookie: adminCookie },
    });
    const teams = await teamsRes.json();
    teamId = teams[0].id;

    // Create invitation
    const inviteRes = await fetch(`${baseUrl}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        teamId,
        email: declineUser.email,
        role: 'member',
      }),
    });
    const invitation = await inviteRes.json();
    invitationId = invitation.id;

    // Register decline user
    const declineRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(declineUser),
    });
    declineCookie = declineRes.headers.get('set-cookie').split(';')[0];
  });

  await t.test('POST /invites/:id/decline declines invitation', async () => {
    const res = await fetch(`${baseUrl}/invites/${invitationId}/decline`, {
      method: 'POST',
      headers: { Cookie: declineCookie },
    });

    assert.equal(res.status, 200);
  });

  await t.test('declined user is not a member of the team', async () => {
    const res = await fetch(`${baseUrl}/teams`, {
      headers: { Cookie: declineCookie },
    });

    assert.equal(res.status, 200);
    const teams = await res.json();
    // User should have their own personal team, but not the admin's team
    const isAdminTeamMember = teams.some((t) => t.id === teamId);
    assert.equal(isAdminTeamMember, false);
  });
});

test('Invitation Authorization', async (t) => {
  const user1 = {
    email: `inv-auth-1-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Inv Auth User 1',
  };

  const user2 = {
    email: `inv-auth-2-${Date.now()}@test.local`,
    password: 'TestPassword123!',
    fullName: 'Inv Auth User 2',
  };

  let cookie1 = '';
  let cookie2 = '';
  let team1Id = '';

  await t.test('setup', async () => {
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

    // User 2
    const res2 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user2),
    });
    cookie2 = res2.headers.get('set-cookie').split(';')[0];
  });

  await t.test('non-admin cannot create invitations', async () => {
    // First, invite user2 as a member
    await fetch(`${baseUrl}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie1,
      },
      body: JSON.stringify({
        teamId: team1Id,
        email: user2.email,
        role: 'member',
      }),
    });

    // Accept invitation
    const invitesRes = await fetch(`${baseUrl}/invites/mine`, {
      headers: { Cookie: cookie2 },
    });
    const invites = await invitesRes.json();
    const invite = invites.find((i) => i.team_id === team1Id);
    if (invite) {
      await fetch(`${baseUrl}/invites/${invite.id}/accept`, {
        method: 'POST',
        headers: { Cookie: cookie2 },
      });
    }

    // Now user2 is a member, try to create invitation as member
    const thirdUser = `third-${Date.now()}@test.local`;
    const res = await fetch(`${baseUrl}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie2,
      },
      body: JSON.stringify({
        teamId: team1Id,
        email: thirdUser,
        role: 'member',
      }),
    });

    // Should be forbidden for non-admin
    assert.ok([403].includes(res.status));
  });

  await t.test('cannot invite to team you are not admin of', async () => {
    const res = await fetch(`${baseUrl}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie2,
      },
      body: JSON.stringify({
        teamId: team1Id,
        email: 'someone@example.com',
        role: 'admin',
      }),
    });

    assert.ok([403, 404].includes(res.status));
  });

  await t.test('GET /invites/team/:teamId requires team membership', async () => {
    // Create a new user who is not a member
    const outsider = {
      email: `outsider-${Date.now()}@test.local`,
      password: 'TestPassword123!',
      fullName: 'Outsider',
    };

    const outsiderRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outsider),
    });
    const outsiderCookie = outsiderRes.headers.get('set-cookie').split(';')[0];

    const res = await fetch(`${baseUrl}/invites/team/${team1Id}`, {
      headers: { Cookie: outsiderCookie },
    });

    assert.ok([403, 404].includes(res.status));
  });
});
