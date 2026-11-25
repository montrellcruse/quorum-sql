import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { generateTestUser, signOut, signUp, waitForDashboard } from './fixtures/auth';

import { createFolder, openFolder } from './fixtures/queries';
import { openWorkspaceTestDatabase } from '../server/tests/fixtures/workspace-db.ts';

const isRosterRequest = (url: URL) =>
  /\/teams\/[^/]+\/members$/.test(url.pathname) ||
  (url.pathname.endsWith('/rest/v1/team_members') && url.searchParams.has('team_id'));

async function holdNextRoster(page: Page, { captureResponse = false } = {}) {
  const requested = Promise.withResolvers<{ url: string; response: APIResponse | undefined }>();
  const release = Promise.withResolvers<void>();
  await page.route(
    isRosterRequest,
    async (route) => {
      const response = captureResponse ? await route.fetch() : undefined;
      requested.resolve({ url: route.request().url(), response });
      await release.promise;
      const deliver = response ? route.fulfill({ response }) : route.continue();
      await deliver.catch(() => {});
    },
    { times: 1 },
  );
  return { requested: requested.promise, release: release.resolve };
}

test('a failed roster read is distinct from a confirmed solo workspace', async ({ page }) => {
  await page.route(isRosterRequest, (route) =>
    route.fulfill({ status: 400, json: { error: 'Roster unavailable' } }),
  );
  await signUp(page, generateTestUser('rostererror'));
  await waitForDashboard(page);
  await expect(page.getByText('Could not load team members.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Start Collaborating' })).toHaveCount(0);
});

test('invitation acceptance and member removal refresh the current team views', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const owner = generateTestUser('rosterowner');
  const invitee = generateTestUser('rosterinvitee');
  await signUp(page, owner);
  await waitForDashboard(page);
  await createFolder(page, 'Roster fixture');
  await openFolder(page, 'Roster fixture');
  const folderId = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.goto('/dashboard');
  const memberContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const member = await memberContext.newPage();
    await signUp(member, invitee);
    await waitForDashboard(member);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel(/invite user by email/i).fill(invitee.email);
    await page.getByRole('button', { name: 'Invite Collaborator' }).click();
    await expect(
      page.getByTestId('invitation-row').filter({ hasText: invitee.email }),
    ).toBeVisible();

    await member.goto('/accept-invites');
    const invitationView = await member.evaluate(() => performance.timeOrigin);
    await member.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(member).toHaveURL(/\/dashboard/);
    expect(await member.evaluate(() => performance.timeOrigin)).toBe(invitationView);
    const selected = member.getByRole('combobox');
    await expect(selected).toContainText(invitee.fullName);
    await selected.click();
    const invitedTeam = member.getByRole('option', { name: new RegExp(owner.fullName) });
    await expect(invitedTeam).toBeVisible();

    const delayed = await holdNextRoster(member);
    try {
      await invitedTeam.click();
      const { url: lateUrl } = await delayed.requested;
      await expect(member.getByText('Loading team members…')).toBeVisible();
      await selected.click();
      await member.getByRole('option', { name: new RegExp(invitee.fullName) }).click();
      await expect(member.getByRole('button', { name: 'Start Collaborating' })).toBeVisible();

      const lateRoster = member.waitForResponse((response) => response.url() === lateUrl);
      delayed.release();
      expect((await lateRoster).ok()).toBe(true);
      await expect(selected).toContainText(invitee.fullName);
      await expect(member.getByRole('button', { name: 'Start Collaborating' })).toBeVisible();
    } finally {
      delayed.release();
    }

    const oldSessionRoster = await holdNextRoster(member, { captureResponse: true });
    const nextUser = generateTestUser('rosterthird');
    const priorDocument = await member.evaluate(() => performance.timeOrigin);
    try {
      await selected.click();
      await member.getByRole('option', { name: new RegExp(owner.fullName) }).click();
      const { url, response } = await oldSessionRoster.requested;
      expect(response?.ok()).toBe(true);
      await signOut(member);
      await signUp(member, nextUser, { alreadyOnAuthPage: true });
      await waitForDashboard(member);

      const sameDocument = (await member.evaluate(() => performance.timeOrigin)) === priorDocument;
      const isSupabase = new URL(url).pathname.endsWith('/rest/v1/team_members');
      expect(sameDocument).toBe(isSupabase);
      if (sameDocument) {
        const lateRoster = member.waitForResponse((response) => response.url() === url);
        oldSessionRoster.release();
        const delivered = await lateRoster;
        expect(delivered.ok()).toBe(true);
        expect(await delivered.finished()).toBeNull();
      }
    } finally {
      oldSessionRoster.release();
    }
    await expect(member.getByRole('combobox')).toHaveCount(0);
    await expect(member.getByRole('button', { name: 'Start Collaborating' })).toBeVisible();

    const databaseUrl = process.env.E2E_TEST_DATABASE_URL;
    if (databaseUrl) {
      const database = openWorkspaceTestDatabase(databaseUrl);
      try {
        await database.addReviewer(folderId, nextUser.email);
      } finally {
        await database.close();
      }
    }
    await page.reload();
    if (databaseUrl) {
      const third = page.getByTestId('member-row').filter({ hasText: nextUser.email });
      await expect(third).toBeVisible();
      await third.getByRole('button').last().click();
      await expect(third).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Team Administration' })).toBeVisible();
    }
    const row = page.getByTestId('member-row').filter({ hasText: invitee.email });
    await expect(row).toBeVisible();
    const adminView = await page.evaluate(() => performance.timeOrigin);
    await row.getByRole('button').last().click();
    await expect(row).toHaveCount(0);
    await expect(page.getByTestId('member-row').filter({ hasText: owner.email })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workspace Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Dashboard' }).click();
    await expect(page.getByRole('button', { name: 'Start Collaborating' })).toBeVisible();
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(adminView);
  } finally {
    await memberContext.close();
  }
});
