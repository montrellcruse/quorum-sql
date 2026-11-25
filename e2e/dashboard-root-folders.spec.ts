import { expect, test } from '@playwright/test';
import { openWorkspaceTestDatabase } from '../server/tests/fixtures/workspace-db.ts';
import { generateTestUser, signUp, waitForDashboard } from './fixtures/auth';
import { createFolder, openFolder } from './fixtures/queries';

test('the dashboard pages root folders before including nested folders', async ({ page }) => {
  const databaseUrl = process.env.E2E_TEST_DATABASE_URL;
  test.skip(!databaseUrl, 'Set E2E_TEST_DATABASE_URL to the app’s isolated local database');
  test.setTimeout(60_000);
  const user = generateTestUser('rootpaging');
  await signUp(page, user);
  await waitForDashboard(page);
  await createFolder(page, 'ZZ parent folder');
  await openFolder(page, 'ZZ parent folder');
  const database = openWorkspaceTestDatabase(databaseUrl!);
  try {
    await database.seedFolderPages(new URL(page.url()).pathname.split('/').at(-1)!);
    await database.createWorkspace('Another workspace', user.email);
  } finally {
    await database.close();
  }
  await page.goto('/dashboard');
  const cards = page.getByTestId('folder-card');
  await expect(cards).toHaveCount(50);
  await expect(cards.first().getByText('Root 001', { exact: true })).toBeVisible();
  await expect(cards.filter({ hasText: 'A nested' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Load more folders' }).click();
  await expect(cards).toHaveCount(52);
  const tiedRoots = cards.filter({ hasText: 'Root 049' });
  await expect(tiedRoots).toHaveCount(3);
  for (const record of [49, 50, 51]) {
    await expect(tiedRoots.getByText(`Root record ${record}`, { exact: true })).toHaveCount(1);
  }
  await expect(cards.last().getByText('ZZ parent folder')).toBeVisible();
  await createFolder(page, 'M new root');
  await expect(cards.first().getByText('M new root', { exact: true })).toBeVisible();
  await expect(cards).toHaveCount(53);

  const selector = page.getByRole('combobox');
  await selector.click();
  await page.getByRole('option', { name: /another workspace/i }).click();
  await expect(page.getByText('No Folders Yet')).toBeVisible();
  await createFolder(page, 'Other workspace root');
  await selector.click();
  await page.getByRole('option', { name: new RegExp(user.fullName) }).click();
  await expect(cards.first().getByText('M new root', { exact: true })).toBeVisible();
  await expect(cards.filter({ hasText: 'Other workspace root' })).toHaveCount(0);
  await openFolder(page, 'ZZ parent folder');
  await expect(page.getByText('A nested 001', { exact: true })).toBeVisible();
});
