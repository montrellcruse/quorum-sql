import { Page, expect } from '@playwright/test';

const POST_AUTH_URL = /\/(dashboard|create-team|accept-invites)/;

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
 * Sign up a new user via the auth page.
 * If the user already exists (e.g. Playwright serial retry), falls back to signIn.
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

  // Click create account
  await page.getByRole('button', { name: /create account/i }).click();

  // Wait for navigation (success) or detect failure (user already exists on retry)
  try {
    await page.waitForURL(POST_AUTH_URL, { timeout: 10000 });
  } catch {
    // Signup failed — user likely already exists from a previous attempt.
    // Fall back to sign in with the same credentials.
    await signIn(page, user);
  }
}

async function hasActiveSession(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('/auth/me');
    if (!response.ok()) return false;
    const payload = await response.json();
    return Boolean(
      payload &&
      typeof payload === 'object' &&
      'id' in payload &&
      typeof (payload as { id?: unknown }).id === 'string'
    );
  } catch {
    return false;
  }
}

async function waitForSession(page: Page, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await hasActiveSession(page)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function apiSignIn(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  const response = await page.request.post('/auth/login', {
    data: { email: user.email, password: user.password },
  });

  if (!response.ok()) {
    const detail = await response.text();
    throw new Error(`API sign-in failed (${response.status()}): ${detail}`);
  }

  try {
    const payload = (await response.json()) as { csrfToken?: string };
    if (payload?.csrfToken) {
      await page.evaluate((csrfToken) => {
        localStorage.setItem('quorum_csrf_token', csrfToken);
      }, payload.csrfToken);
    }
  } catch {
    // Ignore non-JSON responses in fallback path.
  }
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

  // Attempt UI sign-in first.
  await page.locator('form button[type="submit"]').click();

  const [navigatedByUi, sessionReadyByUi] = await Promise.all([
    page.waitForURL(POST_AUTH_URL, { timeout: 12000 }).then(() => true).catch(() => false),
    waitForSession(page, 5000),
  ]);

  // If UI sign-in did not produce a stable session, use direct API fallback.
  if (!navigatedByUi || !sessionReadyByUi || page.url().includes('/auth')) {
    await apiSignIn(page, user);
    const sessionReadyByApi = await waitForSession(page, 8000);
    if (!sessionReadyByApi) {
      throw new Error('Sign-in failed: session did not initialize');
    }

    await page.goto('/dashboard');
    await expect(page).toHaveURL(POST_AUTH_URL, { timeout: 20000 });
  }
}

/**
 * Ensure a signed-in user can reach dashboard, completing create-team onboarding when needed.
 */
export async function ensureDashboardReady(page: Page): Promise<void> {
  // If routed to create-team, either finish onboarding or return to dashboard
  // if the user already has a workspace (stale redirect case).
  if (page.url().includes('/create-team')) {
    const teamsResponse = await page.request.get('/teams');
    let teamCount = 0;
    if (teamsResponse.ok()) {
      try {
        const payload = await teamsResponse.json();
        if (Array.isArray(payload)) {
          teamCount = payload.length;
        }
      } catch {
        teamCount = 0;
      }
    }

    if (teamCount > 0) {
      await page.goto('/dashboard');
    } else {
      const teamName = `E2E Workspace ${Date.now()}`;
      await page.getByLabel(/team name/i).fill(teamName);
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 20000 }),
        page.getByRole('button', { name: /create team/i }).click(),
      ]);
    }
  }
}

/**
 * Sign out the current user.
 * Resilient to cases where the user is already signed out (e.g. serial retries).
 */
export async function signOut(page: Page): Promise<void> {
  // If already on auth page, we're already signed out
  if (page.url().includes('/auth')) {
    return;
  }

  // Sign out button is only on dashboard, so navigate there first if needed
  if (!page.url().includes('/dashboard')) {
    await page.goto('/dashboard');
    // If we got redirected to /auth, we're already signed out
    try {
      await expect(page).toHaveURL(/\/(dashboard|auth)/, { timeout: 10000 });
    } catch {
      // Unexpected URL — bail
    }
    if (page.url().includes('/auth')) {
      return;
    }
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
  await ensureDashboardReady(page);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
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
