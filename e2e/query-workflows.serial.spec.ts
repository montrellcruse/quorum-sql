import { test, expect } from './fixtures/quarantine';
import {
  generateTestUser,
  signUp,
  signIn,
  waitForDashboard,
} from './fixtures/auth';
import { createFolder, openFolder, submitForApproval } from './fixtures/queries';

test.describe('Query Workflow Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser: { email: string; password: string; fullName: string };
  let folderName: string;
  let createdQueryTitle: string;

  test.beforeAll(() => {
    testUser = generateTestUser('query');
    folderName = `Query Test Folder ${Date.now()}`;
  });

  test('user can create a folder', async ({ page }) => {
    await signUp(page, testUser);
    await waitForDashboard(page);

    // Create a folder
    await createFolder(page, folderName, 'Test folder for queries');

    // Verify folder appears on dashboard
    await expect(
      page.locator('[data-testid="folder-card"]').filter({ hasText: folderName }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('user can navigate into a folder', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    await openFolder(page, folderName);

    // Folder name should be visible
    await expect(page.locator('body')).toContainText(folderName);
  });

  test('user can create a new query', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Navigate to folder
    await openFolder(page, folderName);

    // Click new query button
    await page.getByRole('button', { name: /new query/i }).click();
    await expect(page).toHaveURL(/\/query\/(new|create|edit\/new)/);

    // Fill in query details
    createdQueryTitle = 'Test Query ' + Date.now();
    await page.getByLabel(/title/i).fill(createdQueryTitle);

    // Wait for Monaco editor and enter SQL
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });
    const monacoContainer = page.locator('.monaco-editor');
    await monacoContainer.waitFor({ state: 'visible', timeout: 10000 });
    await monacoContainer.click();
    await page.keyboard.type('SELECT id, name FROM users WHERE active = true;');

    // Save the query
    await page.getByRole('button', { name: /save draft|save/i }).click();
    await expect(page).toHaveURL(/\/folder\//, { timeout: 10000 });

    const createdQueryCard = page
      .locator('[data-testid="query-card"]')
      .filter({ hasText: createdQueryTitle })
      .first();
    await expect(createdQueryCard).toBeVisible({ timeout: 10000 });
    await expect(createdQueryCard.getByText(/draft/i)).toBeVisible();
  });

  test('user can edit an existing query', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Navigate to folder
    await openFolder(page, folderName);

    // Open query editor for the query created in the previous step
    const queryCard = page
      .locator('[data-testid="query-card"]')
      .filter({ hasText: createdQueryTitle })
      .first();
    await expect(queryCard).toBeVisible({ timeout: 10000 });
    await queryCard.getByRole('button', { name: /edit/i }).click();
    await expect(page).toHaveURL(/\/query\/edit\//);

    // Modify the query title
    const titleInput = page.getByLabel(/title/i);
    await titleInput.clear();
    await titleInput.fill('Updated Test Query');

    // Save changes
    await page.getByRole('button', { name: /save draft|save/i }).click();
    await expect(page).toHaveURL(/\/folder\//, { timeout: 10000 });
    await expect(
      page.locator('[data-testid="query-card"]').filter({ hasText: 'Updated Test Query' }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('user can submit query for approval', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Navigate to folder
    await openFolder(page, folderName);

    // Open the query view
    await page.getByRole('heading', { name: /updated test query|test query/i }).first().click();
    await expect(page).toHaveURL(/\/query\/view\//);

    await submitForApproval(page);
    await expect(page.getByText(/approved|pending approval/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('user can view query history', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Navigate to folder
    await openFolder(page, folderName);

    // Click on the query
    await page.getByRole('heading', { name: /updated test query|test query/i }).first().click();
    await expect(page).toHaveURL(/\/query\/view\//);

    await expect(page.getByRole('heading', { name: /change history/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('user can delete a folder', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Open folder — must delete all queries inside before the folder can be removed
    await openFolder(page, folderName);

    // Delete each query in the folder via query view page.
    // Using the query title heading avoids clicking non-interactive card regions.
    while (true) {
      await expect(page.getByText(/loading\.\.\./i)).not.toBeVisible({ timeout: 10000 });
      const queryCards = page.locator('[data-testid="query-card"]');
      const queryCount = await queryCards.count();
      if (queryCount === 0) break;

      await queryCards.first().getByRole('heading').first().click();
      await expect(page).toHaveURL(/\/query\/view\//, { timeout: 10000 });

      await page.getByRole('button', { name: /^delete query$/i }).click();
      const queryDeleteDialog = page.getByRole('alertdialog');
      await expect(queryDeleteDialog).toBeVisible({ timeout: 5000 });
      await queryDeleteDialog.getByRole('button', { name: /^delete query$/i }).click();

      await expect(page).toHaveURL(/\/folder\//, { timeout: 10000 });
    }

    await expect(page.locator('[data-testid="query-card"]')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(/no queries yet/i)).toBeVisible({ timeout: 10000 });

    // Now delete the empty folder
    await page.getByRole('button', { name: /delete folder/i }).first().click();

    const deleteDialog = page.getByRole('alertdialog');
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });
    await deleteDialog.getByRole('button', { name: /delete folder/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(
      page.locator('[data-testid="folder-card"]').filter({ hasText: folderName })
    ).toHaveCount(0, { timeout: 10000 });
  });
});

test.describe('Query Editor Features', () => {
  test('Monaco editor loads correctly', async ({ page }) => {
    const testUser = generateTestUser('editor');
    await signUp(page, testUser);
    await waitForDashboard(page);

    // Create a folder
    const folderName = `Editor Test ${Date.now()}`;
    await createFolder(page, folderName);

    // Navigate to folder
    await openFolder(page, folderName);

    // Create new query
    await page.getByRole('button', { name: /new query/i }).click();

    // Monaco should load
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });
    const monaco = page.locator('.monaco-editor');
    await expect(monaco).toBeVisible({ timeout: 10000 });

    // Should have SQL syntax highlighting class
    await expect(monaco.locator('.view-lines')).toBeVisible();
  });

  test('query title is required', async ({ page }) => {
    const testUser = generateTestUser('title-req');
    await signUp(page, testUser);
    await waitForDashboard(page);

    // Create a folder
    const folderName = `Title Test ${Date.now()}`;
    await createFolder(page, folderName);

    // Navigate to folder
    await openFolder(page, folderName);

    // Create new query
    await page.getByRole('button', { name: /new query/i }).click();

    // Wait for editor
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });

    // Enter SQL but leave title empty
    const monacoContainer = page.locator('.monaco-editor');
    await monacoContainer.click();
    await page.keyboard.type('SELECT 1;');

    // Try to save without title
    await page.getByRole('button', { name: /save draft|save/i }).click();

    // Save should be blocked and user should remain on editor page with a validation error
    await expect(page).toHaveURL(/\/query\/edit\/new/);
    await expect(
      page.getByText(/query title cannot be empty|title.*required|title.*empty/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Query Status Transitions', () => {
  test('query starts as draft', async ({ page }) => {
    const testUser = generateTestUser('status');
    await signUp(page, testUser);
    await waitForDashboard(page);

    const folderName = `Status Test ${Date.now()}`;
    await createFolder(page, folderName);
    await openFolder(page, folderName);

    // Create new query
    await page.getByRole('button', { name: /new query/i }).click();
    await page.getByLabel(/title/i).fill('Status Test Query');

    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });
    const monacoContainer = page.locator('.monaco-editor');
    await monacoContainer.waitFor({ state: 'visible', timeout: 10000 });
    await monacoContainer.click();
    await page.keyboard.type('SELECT 1;');

    await page.getByRole('button', { name: /save draft|save/i }).click();
    await expect(page).toHaveURL(/\/folder\//, { timeout: 10000 });

    // Verify status badge shows draft on the query card
    const statusCard = page
      .locator('[data-testid="query-card"]')
      .filter({ hasText: 'Status Test Query' })
      .first();
    await expect(statusCard).toBeVisible({ timeout: 10000 });
    await expect(statusCard.getByText(/draft/i)).toBeVisible();
  });
});
