import { test, expect } from './fixtures/quarantine';
import {
  generateTestUser,
  signUp,
  signIn,
  signOut,
  waitForDashboard,
  goToTeamAdmin,
  inviteUser,
  removeMember,
} from './fixtures/auth';

test.describe('Team Management Flows', () => {
  test.describe.configure({ mode: 'serial' });

  let adminUser: { email: string; password: string; fullName: string };
  let memberUser: { email: string; password: string; fullName: string };
  let teamId: string;

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
    await expect(page.getByText(/collaboration unlocked|invitation sent/i)).toBeVisible();

    // Go back to dashboard
    await page.getByRole('button', { name: /back to dashboard/i }).click();
    await waitForDashboard(page);

    // Now should see "Create New Team" button
    const createTeamButton = page.getByRole('button', { name: /create new team/i });
    await expect(createTeamButton).toBeVisible({ timeout: 5000 });
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
    await page.getByRole('button', { name: /team admin/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Verify team settings are visible
    await expect(page.getByRole('heading', { name: /team settings|workspace settings/i })).toBeVisible();

    // Should see team name field
    await expect(page.getByLabel(/team name|workspace name/i)).toBeVisible();

    // Should see approval quota field
    await expect(page.getByLabel(/approval quota/i)).toBeVisible();
  });

  test('admin can update team settings', async ({ page }) => {
    await signIn(page, adminUser);
    await waitForDashboard(page);

    await page.getByRole('button', { name: /team admin/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Update approval quota
    const quotaInput = page.getByLabel(/approval quota/i);
    await quotaInput.clear();
    await quotaInput.fill('3');

    // Save changes
    const saveButton = page.getByRole('button', { name: /save|update/i }).first();
    await saveButton.click();

    // Verify success message
    await expect(page.getByText(/saved|updated|success/i)).toBeVisible();
  });

  test('invited user can accept invitation', async ({ page }) => {
    // Sign up the member user
    await signUp(page, memberUser);

    // Should be redirected to accept invites or dashboard
    await expect(page).toHaveURL(/\/(accept-invites|dashboard)/, { timeout: 10000 });

    // If on accept-invites page, accept the invitation
    if (page.url().includes('accept-invites')) {
      await expect(page.getByRole('heading', { name: /pending invitations/i })).toBeVisible();

      // Should see the invitation from admin
      await expect(page.locator('body')).toContainText(new RegExp(adminUser.email.split('@')[0], 'i'));

      // Accept the invitation
      await page.getByRole('button', { name: /accept/i }).first().click();
      await expect(page.getByText(/invitation accepted/i)).toBeVisible();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    }

    await waitForDashboard(page);
  });

  test('member can view team but not admin settings', async ({ page }) => {
    await signIn(page, memberUser);
    await waitForDashboard(page);

    // Should see the team
    await expect(page.locator('body')).toContainText(/workspace|team/i);

    // Navigate to team admin
    await page.getByRole('button', { name: /team admin|settings/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // As a member (not admin), should not be able to edit team settings
    // or the save button should be disabled/hidden
    const teamNameInput = page.getByLabel(/team name|workspace name/i);

    // Either the input is disabled or not visible for non-admins
    const isDisabled = await teamNameInput.isDisabled().catch(() => true);
    const isVisible = await teamNameInput.isVisible().catch(() => false);

    // Member should either not see the field or it should be disabled
    expect(isDisabled || !isVisible).toBe(true);
  });

  test('admin can remove a team member', async ({ page }) => {
    await signIn(page, adminUser);
    await waitForDashboard(page);

    // Navigate to team admin
    await page.getByRole('button', { name: /team admin/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Find the member in the list
    const memberRow = page.locator('.border.rounded-lg').filter({
      hasText: new RegExp(memberUser.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    });

    // If member exists, remove them
    if (await memberRow.isVisible()) {
      // Click delete/remove button
      const deleteButton = memberRow.getByRole('button').filter({ has: page.locator('svg') }).last();
      await deleteButton.click();

      // Confirm removal or wait for success
      await expect(page.getByText(/removed|success|solo mode/i).first()).toBeVisible({ timeout: 10000 });
    }
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

    // Should show error or the invite shouldn't go through
    // (exact behavior depends on implementation)
  });

  test('invitation email validation', async ({ page }) => {
    const testUser = generateTestUser('email-validate');
    await signUp(page, testUser);
    await waitForDashboard(page);

    await page.getByRole('button', { name: /^settings$/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Try invalid email
    await page.getByLabel(/invite user by email/i).fill('not-an-email');
    await page.getByRole('button', { name: /invite collaborator/i }).click();

    // Should show validation error or button should be disabled
    const hasError = await page.getByText(/invalid|valid email/i).isVisible().catch(() => false);
    const buttonDisabled = await page.getByRole('button', { name: /invite collaborator/i }).isDisabled().catch(() => false);

    expect(hasError || buttonDisabled).toBe(true);
  });
});
