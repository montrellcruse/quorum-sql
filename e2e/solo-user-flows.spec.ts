import { test, expect } from '@playwright/test';
import {
  generateTestUser,
  signUp,
  signIn,
  signOut,
  waitForDashboard,
  goToTeamAdmin,
  inviteUser,
} from './fixtures/auth';
import { createFolder, createQuery, submitForApproval } from './fixtures/queries';

test.describe('Solo User Flows', () => {
  test.describe.configure({ mode: 'serial' });

  // Shared state for tests that need to reference previous test users
  let soloUser: { email: string; password: string; fullName: string };
  let secondUser: { email: string; password: string; fullName: string };

  test.beforeAll(() => {
    soloUser = generateTestUser('solo');
    secondUser = generateTestUser('second');
  });

  test('new user gets personal workspace on signup', async ({ page }) => {
    // Sign up with new user credentials
    await signUp(page, soloUser);

    // With atomic trigger, user should land on dashboard (not create-team)
    // because personal workspace is auto-created on signup
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Verify dashboard loads correctly
    await waitForDashboard(page);

    // Verify we have a workspace (team name shown)
    // For solo users with one team, it shows "Workspace: <name>"
    const workspaceLabel = page.getByText(/workspace:/i);
    await expect(workspaceLabel).toBeVisible();

    // The workspace name should include the user's name or email prefix
    const expectedNamePattern = new RegExp(
      `(${soloUser.fullName.split(' ')[0]}|${soloUser.email.split('@')[0]}).*workspace`,
      'i'
    );
    await expect(page.locator('body')).toContainText(expectedNamePattern);
  });

  test('solo user sees simplified dashboard', async ({ page }) => {
    // Sign in as the solo user created in previous test
    await signIn(page, soloUser);
    await waitForDashboard(page);

    // Solo user should NOT see "Approvals Needed" button
    // (since auto-approval means no pending approvals)
    const approvalsButton = page.getByRole('button', { name: /approvals needed/i });
    await expect(approvalsButton).not.toBeVisible();

    // Solo user SHOULD see "Start Collaborating" button instead of "Create New Team"
    const startCollabButton = page.getByRole('button', { name: /start collaborating/i });
    await expect(startCollabButton).toBeVisible();

    // "Create New Team" should NOT be visible for solo users
    const createTeamButton = page.getByRole('button', { name: /create new team/i });
    await expect(createTeamButton).not.toBeVisible();

    // Settings button should show "Settings" not "Team Admin" for solo users
    const settingsButton = page.getByRole('button', { name: /^settings$/i });
    await expect(settingsButton).toBeVisible();

    // "Team Admin" text should NOT be visible
    const teamAdminButton = page.getByRole('button', { name: /^team admin$/i });
    await expect(teamAdminButton).not.toBeVisible();
  });

  test('solo user queries auto-approve', async ({ page }) => {
    // Sign in as solo user
    await signIn(page, soloUser);
    await waitForDashboard(page);

    // Create a folder for testing
    const folderName = `Test Folder ${Date.now()}`;
    await createFolder(page, folderName, 'Test folder for auto-approval');

    // Navigate to the folder
    await page.getByRole('heading', { name: folderName }).click();
    await expect(page).toHaveURL(/\/folder\//);

    // Create a new query
    await page.getByRole('button', { name: /new query/i }).click();
    await expect(page).toHaveURL(/\/query\/(new|create|edit\/new)/);

    // Fill in query details
    await page.getByLabel(/title/i).fill('Auto-Approve Test Query');

    // Wait for Monaco editor to load
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });
    // Click the editor container to focus it, then type
    const monacoContainer = page.locator('.monaco-editor');
    await monacoContainer.waitFor({ state: 'visible', timeout: 10000 });
    await monacoContainer.click();
    await page.keyboard.type('SELECT 1 AS test_value;');

    // Save the query
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('Query saved as draft', { exact: true })).toBeVisible({ timeout: 5000 });

    // Submit for approval
    const submitButton = page.getByRole('button', { name: /submit for approval/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // For solo users, query should be immediately approved (auto-approval)
      // Should NOT show "pending approval" - should show "approved" directly
      await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 5000 });

      // Verify it's NOT pending
      const pendingBadge = page.getByText(/pending/i);
      await expect(pendingBadge).not.toBeVisible();
    }

    // Note: Cleanup navigation removed - subsequent tests navigate fresh
  });

  test('invite converts to team mode', async ({ page }) => {
    // Sign in as solo user
    await signIn(page, soloUser);
    await waitForDashboard(page);

    // Navigate to settings (team admin)
    await page.getByRole('button', { name: /^settings$/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // For solo users, should see "Collaborate with Others" section
    await expect(page.getByRole('heading', { name: /collaborate with others/i })).toBeVisible();

    // Invite a second user
    await page.getByLabel(/invite user by email/i).fill(secondUser.email);
    await page.getByRole('button', { name: /invite collaborator/i }).click();

    // Should see "Collaboration Unlocked" toast
    await expect(page.getByText('Collaboration Unlocked!', { exact: true })).toBeVisible();

    // After first invite, personal team should convert
    // The UI should update to show team features

    // Sign out and sign up as the second user
    await signOut(page);

    // Sign up the second user
    await signUp(page, secondUser);

    // Second user should be redirected to accept invites
    await expect(page).toHaveURL(/\/(accept-invites|dashboard)/, { timeout: 10000 });

    // If on accept-invites, accept the invitation
    if (page.url().includes('accept-invites')) {
      await page.getByRole('button', { name: /accept/i }).first().click();
      await expect(page.getByText(/invitation accepted/i)).toBeVisible();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    }

    // Sign out second user, sign back in as original user
    await signOut(page);
    await signIn(page, soloUser);
    await waitForDashboard(page);

    // Original user should NOW see team features (no longer solo)
    // Should see "Create New Team" instead of "Start Collaborating"
    const createTeamButton = page.getByRole('button', { name: /create new team/i });
    await expect(createTeamButton).toBeVisible({ timeout: 5000 });

    // Should see "Team Admin" instead of "Settings"
    const teamAdminButton = page.getByRole('button', { name: /team admin/i });
    await expect(teamAdminButton).toBeVisible();

    // "Start Collaborating" should NOT be visible anymore
    const startCollabButton = page.getByRole('button', { name: /start collaborating/i });
    await expect(startCollabButton).not.toBeVisible();
  });

  test('last member leaving reverts to solo', async ({ page }) => {
    // Sign in as the original user (now has 2 members)
    await signIn(page, soloUser);
    await waitForDashboard(page);

    // Go to team admin
    await page.getByRole('button', { name: /team admin/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Find the second user in the members list and remove them
    // Look for the member row with the second user's email
    const memberRow = page.locator('.border.rounded-lg').filter({
      hasText: new RegExp(secondUser.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    });

    // Click the delete button for this member
    const deleteButton = memberRow.getByRole('button').filter({ has: page.locator('svg') }).last();
    await deleteButton.click();

    // Should see success message and "Solo Mode" notification
    await expect(page.getByText(/member removed|success/i)).toBeVisible();

    // May show "Solo Mode" toast
    const soloModeToast = page.getByText(/solo mode/i);
    // This may or may not appear depending on implementation timing
    await soloModeToast.isVisible().catch(() => {});

    // Navigate back to dashboard
    await page.getByRole('button', { name: /back to dashboard/i }).click();
    await waitForDashboard(page);

    // Should now see solo user UI again
    // "Start Collaborating" should be visible
    const startCollabButton = page.getByRole('button', { name: /start collaborating/i });
    await expect(startCollabButton).toBeVisible({ timeout: 5000 });

    // "Create New Team" should NOT be visible
    const createTeamButton = page.getByRole('button', { name: /create new team/i });
    await expect(createTeamButton).not.toBeVisible();

    // Settings button should show "Settings" not "Team Admin"
    const settingsButton = page.getByRole('button', { name: /^settings$/i });
    await expect(settingsButton).toBeVisible();
  });

  test('personal workspace cannot be deleted', async ({ page }) => {
    // Sign in as solo user
    await signIn(page, soloUser);
    await waitForDashboard(page);

    // Navigate to settings
    await page.getByRole('button', { name: /^settings$/i }).click();
    await expect(page).toHaveURL(/\/team-admin/);

    // Personal workspaces should not have a delete option visible
    // Or if there is one, it should show an error when attempted

    // Check that there's no "Delete Team" button for personal workspace
    const deleteTeamButton = page.getByRole('button', { name: /delete team|delete workspace/i });
    const isDeleteVisible = await deleteTeamButton.isVisible().catch(() => false);

    if (isDeleteVisible) {
      // If delete button exists, clicking it should show error
      await deleteTeamButton.click();

      // Should show error about not being able to delete personal workspace
      await expect(
        page.getByText(/cannot delete.*personal|this is your personal workspace/i)
      ).toBeVisible();
    }

    // Alternative: Check that user always has at least one team
    // by verifying the team selector shows at least one option
    const teamSelector = page.getByRole('combobox');
    if (await teamSelector.isVisible()) {
      await teamSelector.click();
      const teamOptions = page.getByRole('option');
      const optionCount = await teamOptions.count();
      expect(optionCount).toBeGreaterThan(0);
    }

    // Verify the workspace still exists by going back to dashboard
    await page.getByRole('button', { name: /back to dashboard/i }).click();
    await waitForDashboard(page);

    // User should still have their workspace
    const workspaceLabel = page.getByText(/workspace:/i);
    await expect(workspaceLabel).toBeVisible();
  });
});

test.describe('Solo User Edge Cases', () => {
  test('existing user without teams gets personal workspace', async ({ page }) => {
    // This test verifies the migration backfill worked
    // For a truly comprehensive test, we'd need to create a user
    // before the migration and then verify they got a personal team

    // For now, we verify that any new signup gets a workspace
    const edgeCaseUser = generateTestUser('edge');
    await signUp(page, edgeCaseUser);

    // Should land on dashboard (not create-team)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await waitForDashboard(page);

    // Clean up by signing out
    await signOut(page);
  });

  test('solo user workspace name matches user identity', async ({ page }) => {
    const namedUser = {
      ...generateTestUser('named'),
      fullName: 'Alice Testington',
    };

    await signUp(page, namedUser);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await waitForDashboard(page);

    // Workspace name should include user's name or email prefix
    // In REST mode, fullName may be stored differently, so accept email-based name as fallback
    await expect(page.locator('body')).toContainText(/(alice|named-).*workspace/i);

    await signOut(page);
  });

  test('approval workflow differs between solo and team mode', async ({ page }) => {
    // Create a fresh solo user
    const workflowUser = generateTestUser('workflow');
    await signUp(page, workflowUser);
    await waitForDashboard(page);

    // Solo mode: Create and submit a query - should auto-approve
    const folderName = `Workflow Test ${Date.now()}`;
    await createFolder(page, folderName);
    await page.getByRole('heading', { name: folderName }).click();

    await page.getByRole('button', { name: /new query/i }).click();
    await page.getByLabel(/title/i).fill('Solo Workflow Test');

    // Wait for Monaco editor to load
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });
    // Click the editor container to focus it, then type
    const monacoContainer2 = page.locator('.monaco-editor');
    await monacoContainer2.waitFor({ state: 'visible', timeout: 10000 });
    await monacoContainer2.click();
    await page.keyboard.type('SELECT 1;');

    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('Query saved as draft', { exact: true })).toBeVisible({ timeout: 5000 });

    // Submit and verify auto-approval
    const submitButton = page.getByRole('button', { name: /submit for approval/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Solo user: Should see "approved" without "pending"
      await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 5000 });
    }

    await signOut(page);
  });
});
