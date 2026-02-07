import { test, expect } from './fixtures/quarantine';
import type { Page } from '@playwright/test';
import {
  generateTestUser,
  signUp,
  signIn,
  signOut,
  waitForDashboard,
} from './fixtures/auth';

test.describe('Team Management Flows', () => {
  test.describe.configure({ mode: 'serial' });

  let adminUser: { email: string; password: string; fullName: string };
  let memberUser: { email: string; password: string; fullName: string };

  const settleInviteLanding = async (page: Page) => {
    await expect(page).toHaveURL(/\/(accept-invites|dashboard|create-team)/, { timeout: 20000 });

    // In CI, invitation visibility can lag briefly; retry accept-invites before failing.
    if (page.url().includes('/create-team')) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await page.goto('/accept-invites');
        await expect(page).toHaveURL(/\/(accept-invites|dashboard|create-team)/, { timeout: 10000 });
        if (!page.url().includes('/create-team')) {
          break;
        }
        await page.waitForTimeout(1000);
      }
    }

    await expect(page).toHaveURL(/\/(accept-invites|dashboard)/, { timeout: 10000 });
  };

  test.beforeAll(() => {
    adminUser = generateTestUser('admin');
    memberUser = generateTestUser('member');
  });

  test('admin can create a new team', async ({ page }) => {
    // Sign up with admin user
    await signUp(page, adminUser);
    await waitForDashboard(page);

    // For solo users, first need to invite someone to unlock team features
    await page.getByRole('button', { name: /^settings$/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Invite the member to unlock team features
    await page.getByLabel(/invite user by email/i).fill(memberUser.email);
    await page.getByRole('button', { name: /invite collaborator/i }).click();
    await expect(page.getByText(/collaboration unlocked|invitation sent/i).first()).toBeVisible();
    await expect(
      page.locator('[data-testid="invitation-row"]').filter({ hasText: memberUser.email })
    ).toBeVisible({ timeout: 15000 });

    // Member must accept invite before admin exits solo mode.
    await signOut(page);
    await signUp(page, memberUser);
    await settleInviteLanding(page);

    if (page.url().includes('accept-invites')) {
      await expect(page.getByRole('heading', { name: /team invitations|pending invitations/i })).toBeVisible();
      await page.getByRole('button', { name: /accept/i }).first().click();
      await expect(page.getByText(/invitation accepted/i).first()).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
    }

    await signOut(page);
    await signIn(page, adminUser);
    await waitForDashboard(page);
    await page.reload();
    await waitForDashboard(page);

    // Now should see "Create New Team" button
    const createTeamButton = page.getByRole('button', { name: /create new team/i });
    await expect(createTeamButton).toBeVisible({ timeout: 15000 });
    await createTeamButton.click();

    // Should navigate to create team page
    await expect(page).toHaveURL(/\/create-team/);

    // Fill in team details
    const teamName = `Test Team ${Date.now()}`;
    await page.getByLabel(/team name/i).fill(teamName);

    // Submit the form
    await page.getByRole('button', { name: /create team/i }).click();

    // Should redirect to dashboard with new team
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await waitForDashboard(page);

    // Verify team was created
    await expect(page.locator('body')).toContainText(new RegExp(teamName, 'i'));
  });

  test('admin can view team settings', async ({ page }) => {
    await signIn(page, adminUser);
    await waitForDashboard(page);

    // Navigate to team admin
    await page.getByRole('button', { name: /team admin|settings/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Verify team settings are visible
    await expect(
      page.getByRole('heading', { name: /team administration|workspace settings|team settings/i })
    ).toBeVisible();

    // Should see team name field
    await expect(page.getByLabel(/workspace name/i)).toBeVisible();

    // Should see approval quota field
    await expect(page.getByLabel(/approval quota/i)).toBeVisible();
  });

  test('admin can update team settings', async ({ page }) => {
    await signIn(page, adminUser);
    await waitForDashboard(page);

    await page.getByRole('button', { name: /team admin|settings/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Update approval quota
    const quotaInput = page.getByLabel(/approval quota/i);
    await quotaInput.clear();
    await quotaInput.fill('3');

    // Save changes
    const saveButton = page.getByRole('button', { name: /^update$/i });
    await saveButton.click();

    // Verify success message
    await expect(page.getByText(/approval quota updated successfully|updated|success/i).first()).toBeVisible();
  });

  test('invited user can accept invitation', async ({ page }) => {
    // Member account may already exist from previous setup flow
    await signIn(page, memberUser);

    // Should be redirected to accept invites or dashboard
    await settleInviteLanding(page);

    // If on accept-invites page, accept the invitation
    if (page.url().includes('accept-invites')) {
      await expect(page.getByRole('heading', { name: /team invitations|pending invitations/i })).toBeVisible();

      // Should see the invitation from admin
      await expect(page.locator('body')).toContainText(new RegExp(adminUser.email.split('@')[0], 'i'));

      // Accept the invitation
      await page.getByRole('button', { name: /accept/i }).first().click();
      await expect(page.getByText(/invitation accepted/i)).toBeVisible();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
    }

    await waitForDashboard(page);
  });

  test('member can view team but not admin settings', async ({ page }) => {
    await signIn(page, memberUser);
    await waitForDashboard(page);

    // Should see the team
    await expect(page.locator('body')).toContainText(/workspace|team/i);

    // Non-admins should not have a team admin/settings entry point.
    const teamAdminButton = page.getByRole('button', { name: /team admin|settings/i });
    await expect(teamAdminButton).toHaveCount(0);

    // Direct navigation should bounce back to dashboard.
    await page.goto('/team-admin');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('admin can remove a team member', async ({ page }) => {
    await signIn(page, adminUser);
    await waitForDashboard(page);

    // Navigate to team admin
    await page.getByRole('button', { name: /team admin|settings/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Find the member in the list
    const memberRow = page.locator('[data-testid="member-row"]').filter({
      hasText: new RegExp(memberUser.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    });
    await expect(memberRow).toBeVisible({ timeout: 10000 });

    // Click delete/remove button
    const deleteButton = memberRow.getByRole('button').last();
    await deleteButton.click();

    // Confirm removal or wait for success
    await expect(page.getByText(/removed|success|solo mode/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Team Invitation Edge Cases', () => {
  test('cannot invite user who is already a member', async ({ page }) => {
    const testUser = generateTestUser('invite-edge');
    await signUp(page, testUser);
    await waitForDashboard(page);

    // Go to settings
    await page.getByRole('button', { name: /^settings$/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Try to invite self
    await page.getByLabel(/invite user by email/i).fill(testUser.email);
    await page.getByRole('button', { name: /invite collaborator/i }).click();

    // Self-invite should not create a pending invitation row for this email.
    await expect(
      page.locator('[data-testid="invitation-row"]').filter({ hasText: testUser.email })
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('invitation email validation', async ({ page }) => {
    const testUser = generateTestUser('email-validate');
    await signUp(page, testUser);
    await waitForDashboard(page);

    await page.getByRole('button', { name: /^settings$/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Try invalid email
    const emailInput = page.getByLabel(/invite user by email/i);
    await emailInput.fill('not-an-email');
    await page.getByRole('button', { name: /invite collaborator/i }).click();

    // HTML5 email validation should block submission.
    const validationMessage = await emailInput.evaluate((input) => (input as HTMLInputElement).validationMessage);
    expect(validationMessage.length).toBeGreaterThan(0);

    // Ensure an invalid email did not create an invitation row.
    await expect(
      page.locator('[data-testid="invitation-row"]').filter({ hasText: 'not-an-email' })
    ).toHaveCount(0);
  });
});
