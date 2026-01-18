import { Page, expect } from '@playwright/test';

/**
 * Test user credentials generator
 * Creates unique test users for each test run
 */
export function generateTestUser(prefix: string = 'test') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return {
    email: `${prefix}-${timestamp}-${random}@test.local`,
    password: 'TestPassword123!',
    fullName: `Test User ${prefix}`,
  };
}

/**
 * Sign up a new user via the auth page
 */
export async function signUp(
  page: Page,
  user: { email: string; password: string; fullName?: string }
): Promise<void> {
  await page.goto('/auth');

  // Click "Create one" to switch to sign up mode
  const createAccountLink = page.getByRole('button', { name: /create one/i });
  await createAccountLink.waitFor({ state: 'visible' });
  await createAccountLink.click();

  // Wait for signup form to appear
  await page.getByLabel(/full name/i).waitFor({ state: 'visible' });

  // Fill in sign up form
  if (user.fullName) {
    await page.getByLabel(/full name/i).fill(user.fullName);
  }
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);

  // Submit
  await page.getByRole('button', { name: /create account/i }).click();

  // Wait for navigation away from auth page
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 10000 });
}

/**
 * Sign in an existing user via the auth page
 */
export async function signIn(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  // Retry logic for flaky sign in
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await page.goto('/auth');

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');

    // Wait for the email input to appear (page loaded)
    await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 10000 });

    // Ensure we're on sign in mode (not sign up)
    const signInLink = page.getByRole('button', { name: /sign in$/i });
    if (await signInLink.isVisible().catch(() => false)) {
      await signInLink.click();
    }

    // Fill in sign in form
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);

    // Wait for network to settle
    await page.waitForLoadState('networkidle');

    // Click sign in button and wait for navigation
    const signInButton = page.getByRole('button', { name: /^sign in$/i });
    await signInButton.click();

    // Wait for the response
    await page.waitForLoadState('networkidle');

    // Wait a moment for any redirect to complete
    await page.waitForTimeout(1000);

    // Check if we successfully navigated away from /auth
    if (!page.url().includes('/auth')) {
      await expect(page).toHaveURL(/\/(dashboard|create-team|accept-invites)/, { timeout: 5000 });
      return;
    }

    // Check for error toast
    const errorToast = page.getByText(/sign in failed|error/i);
    if (await errorToast.isVisible().catch(() => false)) {
      throw new Error('Sign in failed with error toast');
    }

    // If on last retry, fail
    if (attempt === maxRetries) {
      throw new Error(`Sign in failed after ${maxRetries} attempts: still on /auth`);
    }

    // Otherwise, retry
    await page.waitForTimeout(500);
  }
}

/**
 * Sign out the current user
 */
export async function signOut(page: Page): Promise<void> {
  // Sign out button is only on dashboard, so navigate there first if needed
  if (!page.url().includes('/dashboard')) {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  }

  const signOutButton = page.getByRole('button', { name: /sign out/i });
  await signOutButton.waitFor({ state: 'visible', timeout: 10000 });
  await signOutButton.click();

  // After sign out, should redirect to /auth (or /create-team during state transition)
  await expect(page).toHaveURL(/\/(auth|create-team)/, { timeout: 10000 });

  // If we landed on /create-team, go to /auth for a clean state
  if (page.url().includes('/create-team')) {
    await page.goto('/auth');
  }

  // Wait for the auth form to stabilize (session fully cleared)
  // The email input being visible indicates the form is ready and not redirecting
  await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Wait for the dashboard to fully load
 */
export async function waitForDashboard(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/);
  // Wait for the main heading to appear
  await expect(page.getByRole('heading', { name: /quorum/i })).toBeVisible();
  // Wait for loading states to finish
  await expect(page.getByText(/loading\.\.\./i)).not.toBeVisible({ timeout: 10000 });
}

/**
 * Navigate to team admin/settings page
 */
export async function goToTeamAdmin(page: Page): Promise<void> {
  // Click on Settings or Team Admin button
  const settingsButton = page.getByRole('button', { name: /settings|team admin/i });
  await settingsButton.click();
  await expect(page).toHaveURL(/\/team-admin/);
}

/**
 * Invite a user to the team
 */
export async function inviteUser(
  page: Page,
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<void> {
  // Fill in the invite form
  await page.getByLabel(/invite user by email/i).fill(email);

  // Select role if not member
  if (role === 'admin') {
    await page.getByLabel(/role/i).click();
    await page.getByRole('option', { name: /admin/i }).click();
  }

  // Click invite button
  await page.getByRole('button', { name: /invite collaborator/i }).click();

  // Wait for success toast
  await expect(page.getByText(/invitation sent|collaboration unlocked/i)).toBeVisible();
}

/**
 * Remove a team member
 */
export async function removeMember(page: Page, memberEmail: string): Promise<void> {
  // Find the member row and click delete
  const memberRow = page.locator('.border.rounded-lg').filter({ hasText: memberEmail });
  await memberRow.getByRole('button', { name: /trash/i }).click();

  // Wait for success
  await expect(page.getByText(/member removed/i)).toBeVisible();
}
