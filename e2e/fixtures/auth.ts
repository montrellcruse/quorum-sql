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

  // Click and wait for navigation atomically
  await Promise.all([
    page.waitForURL(/\/(dashboard|create-team|accept-invites)/, { timeout: 15000 }),
    page.getByRole('button', { name: /create account/i }).click(),
  ]);
}

/**
 * Sign in an existing user via the auth page
 */
export async function signIn(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  await page.goto('/auth');

  // Wait for the email input to appear (page loaded)
  await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 10000 });

  // Check if we're on sign up mode and need to switch to sign in
  const createAccountButton = page.getByRole('button', { name: /create account/i });
  if (await createAccountButton.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });
  }

  // Fill in sign in form
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);

  // Click and wait for navigation atomically
  await Promise.all([
    page.waitForURL(/\/(dashboard|create-team|accept-invites)/, { timeout: 15000 }),
    page.locator('form button[type="submit"]').click(),
  ]);
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

  // After sign out, should redirect to /auth with signout param (then cleaned)
  await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });

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
