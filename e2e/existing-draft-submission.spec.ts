import { test, expect, type Page, type Response } from '@playwright/test';
import { generateTestUser, signUp, waitForDashboard } from './fixtures/auth';
import { createFolder, openFolder } from './fixtures/queries';
import { openDraftSubmissionTestDatabase } from '../server/tests/fixtures/draft-submission-db.mjs';

const databaseUrl = process.env.E2E_TEST_DATABASE_URL;
const original = {
  title: 'Draft before submission',
  description: 'Original description',
  sql_content: 'SELECT 1;',
};
const edits = {
  title: 'Updated draft',
  description: 'Updated description',
  sql_content: 'SELECT 2;',
};

async function fillDraft(page: Page, values: typeof original) {
  await page.getByLabel('Title', { exact: true }).fill(values.title);
  await page.getByLabel('Description', { exact: true }).fill(values.description);
  await page.locator('.monaco-editor').click();
  const isMacEditor = await page.evaluate(() => navigator.userAgent.includes('Macintosh'));
  await page.keyboard.press(isMacEditor ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText(values.sql_content);
}

async function createExistingDraft(page: Page) {
  await signUp(page, generateTestUser('atomicdraft'));
  await waitForDashboard(page);
  const folder = 'Draft submission tests';
  await createFolder(page, folder);
  await openFolder(page, folder);
  if (databaseUrl) {
    const database = openDraftSubmissionTestDatabase(databaseUrl);
    try {
      await database.seedDraft(new URL(page.url()).pathname.split('/').at(-1), original);
    } finally {
      await database.close();
    }
    await page.reload();
  } else {
    await page.getByRole('button', { name: 'New Query', exact: true }).click();
    await fillDraft(page, original);
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  }
  const card = page.getByTestId('query-card').filter({ hasText: original.title });
  await expect(card.getByText('Draft', { exact: true })).toBeVisible();
  await card.getByRole('heading', { name: original.title }).click();
  await expect(page).toHaveURL(/\/query\/view\//);
  const view = new URL(page.url()).pathname;
  return { view, id: view.split('/').at(-1)!, edit: view.replace('/view/', '/edit/') };
}

async function submit(page: Page, source: 'editor' | 'view', reason: string) {
  await page
    .getByRole('button', {
      name: source === 'editor' ? 'Request Approval' : 'Submit for Approval',
      exact: true,
    })
    .click();
  const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
  await dialog.getByLabel(/change reason/i).fill(reason);
  await dialog.getByRole('button', { name: 'Submit for Approval', exact: true }).click();
}

function isDraftRead(response: Response, id: string, data: 'query' | 'history') {
  if (response.request().method() !== 'GET') return false;
  const url = new URL(response.url());
  if (data === 'query') {
    return (
      url.pathname.endsWith(`/queries/${id}`) ||
      (url.pathname.endsWith('/rest/v1/sql_queries') && url.searchParams.get('id') === `eq.${id}`)
    );
  }
  return (
    url.pathname.endsWith(`/queries/${id}/history`) ||
    (url.pathname.endsWith('/rest/v1/query_history') &&
      url.searchParams.get('query_id') === `eq.${id}`)
  );
}

// Read the committed query and history through the provider selected by the running application.
async function readStoredDraft(page: Page, draft: { view: string; id: string }) {
  await page.goto('about:blank');
  const read = async (data: 'query' | 'history') => {
    const response = await page.waitForResponse((response) =>
      isDraftRead(response, draft.id, data),
    );
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const [query, history] = await Promise.all([
    read('query'),
    read('history'),
    page.goto(draft.view),
  ]);
  return { query, history };
}

test('submits a saved draft from query view with its approved history', async ({ page }) => {
  const draft = await createExistingDraft(page);
  await page.goto(draft.edit);
  const description = 'Saved for review';
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page).toHaveURL(/\/folder\//);
  const saved = await readStoredDraft(page, draft);
  expect(saved.query).toMatchObject({ ...original, description, status: 'draft' });
  expect(saved.history).toEqual([]);

  await submit(page, 'view', 'Review the saved SQL');
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  const stored = await readStoredDraft(page, draft);
  expect(stored.query).toMatchObject({ ...original, description, status: 'approved' });
  expect(stored.history).toMatchObject([
    {
      sql_content: original.sql_content,
      status: 'approved',
      change_reason: 'Review the saved SQL',
    },
  ]);
});

test('submits edits to an existing draft from the editor', async ({ page }) => {
  const draft = await createExistingDraft(page);
  await page.goto(draft.edit);
  await fillDraft(page, edits);
  await submit(page, 'editor', 'Update the draft before submission');
  await expect(page).toHaveURL(/\/folder\//);
  const stored = await readStoredDraft(page, draft);
  expect(stored.query).toMatchObject({ ...edits, status: 'approved' });
  expect(stored.history).toMatchObject([
    {
      sql_content: edits.sql_content,
      status: 'approved',
      change_reason: 'Update the draft before submission',
    },
  ]);
});

// Run this test in each deployment mode with E2E_TEST_DATABASE_URL pointing to its disposable DB.
test('rolls back an existing draft when history fails and commits exactly one version on retry', async ({
  page,
  context,
  browser,
}) => {
  test.skip(!databaseUrl, 'Set E2E_TEST_DATABASE_URL to the app’s isolated local database');
  test.setTimeout(90_000);
  const draft = await createExistingDraft(page);
  const persistedView = await context.newPage();
  const baseline = await readStoredDraft(persistedView, draft);
  expect(baseline.query).toMatchObject({ ...original, status: 'draft' });
  expect(baseline.history).toEqual([]);

  const database = openDraftSubmissionTestDatabase(databaseUrl!);
  const reviewerContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const reviewerPage = await reviewerContext.newPage();
    const reviewer = generateTestUser('draftreviewer');
    await signUp(reviewerPage, reviewer);
    await database.addReviewer(draft.id, reviewer.email);

    await page.goto(draft.edit);
    await fillDraft(page, edits);
    const restoreHistoryWrites = await database.rejectHistoryWrites(draft.id);
    try {
      await submit(page, 'editor', 'Request a team review');
      await expect(page.getByText('Submission failed', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(edits.title);
      await expect(page.getByLabel('Description', { exact: true })).toHaveValue(edits.description);
      await expect(page.getByLabel(/change reason/i)).toHaveValue('Request a team review');
      expect(await readStoredDraft(persistedView, draft)).toEqual(baseline);
    } finally {
      await restoreHistoryWrites();
    }

    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Submit for Approval', exact: true })
      .click();
    await expect(page).toHaveURL(/\/folder\//);
    const reviewed = await readStoredDraft(reviewerPage, draft);
    expect(reviewed.query).toMatchObject({ ...edits, status: 'pending_approval' });
    expect(reviewed.history).toMatchObject([
      {
        sql_content: edits.sql_content,
        status: 'pending_approval',
        change_reason: 'Request a team review',
      },
    ]);
    await expect(reviewerPage.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  } finally {
    await reviewerContext.close();
    await database.close();
  }
});
