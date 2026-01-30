import { test, expect } from './fixtures/quarantine';
import {
  generateTestUser,
  signUp,
  signIn,
  signOut,
  waitForDashboard,
} from './fixtures/auth';
import { createFolder, createQuery } from './fixtures/queries';

test.describe('Query Workflow Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser: { email: string; password: string; fullName: string };
  let folderName: string;

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
    await expect(page.getByRole('heading', { name: folderName })).toBeVisible();
  });

  test('user can navigate into a folder', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Click on the folder
    await page.getByRole('heading', { name: folderName }).click();

    // Should navigate to folder page
    await expect(page).toHaveURL(/\/folder\//);

    // Folder name should be visible
    await expect(page.locator('body')).toContainText(folderName);
  });

  test('user can create a new query', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Navigate to folder
    await page.getByRole('heading', { name: folderName }).click();
    await expect(page).toHaveURL(/\/folder\//);

    // Click new query button
    await page.getByRole('button', { name: /new query/i }).click();
    await expect(page).toHaveURL(/\/query\/(new|create|edit\/new)/);

    // Fill in query details
    const queryTitle = 'Test Query ' + Date.now();
    await page.getByLabel(/title/i).fill(queryTitle);

    // Wait for Monaco editor and enter SQL
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });
    const monacoContainer = page.locator('.monaco-editor');
    await monacoContainer.waitFor({ state: 'visible', timeout: 10000 });
    await monacoContainer.click();
    await page.keyboard.type('SELECT id, name FROM users WHERE active = true;');

    // Save the query
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/query saved/i)).toBeVisible({ timeout: 5000 });
  });

  test('user can edit an existing query', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Navigate to folder
    await page.getByRole('heading', { name: folderName }).click();
    await expect(page).toHaveURL(/\/folder\//);

    // Click on an existing query (should be the one we created)
    const queryLink = page.getByText(/test query/i).first();
    await queryLink.click();

    // Should be on query view or edit page
    await expect(page).toHaveURL(/\/query\//);

    // Click edit button if in view mode
    const editButton = page.getByRole('button', { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Modify the query title
    const titleInput = page.getByLabel(/title/i);
    await titleInput.clear();
    await titleInput.fill('Updated Test Query');

    // Save changes
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/saved|updated/i)).toBeVisible({ timeout: 5000 });
  });

  test('user can submit query for approval', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Navigate to folder
    await page.getByRole('heading', { name: folderName }).click();

    // Click on the query
    const queryLink = page.getByText(/updated test query|test query/i).first();
    await queryLink.click();

    // Submit for approval
    const submitButton = page.getByRole('button', { name: /submit for approval/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // For solo user, should auto-approve
      await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('user can view query history', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Navigate to folder
    await page.getByRole('heading', { name: folderName }).click();

    // Click on the query
    const queryLink = page.getByText(/updated test query|test query/i).first();
    await queryLink.click();

    // Look for history tab or section
    const historyTab = page.getByRole('tab', { name: /history/i });
    if (await historyTab.isVisible()) {
      await historyTab.click();

      // Should show version history
      await expect(page.getByText(/version|v\d+/i)).toBeVisible();
    }
  });

  test('user can delete a folder', async ({ page }) => {
    await signIn(page, testUser);
    await waitForDashboard(page);

    // Find the folder card and look for delete option
    const folderCard = page.locator('.card, [data-testid="folder-card"]').filter({
      hasText: folderName,
    });

    // Hover or click to reveal delete button
    await folderCard.hover();

    // Look for delete button (might be in a dropdown menu)
    const deleteButton = folderCard.getByRole('button', { name: /delete/i });
    const menuButton = folderCard.getByRole('button').filter({ has: page.locator('svg') });

    if (await deleteButton.isVisible()) {
      await deleteButton.click();
    } else if (await menuButton.isVisible()) {
      await menuButton.first().click();
      // Look for delete in dropdown
      const deleteOption = page.getByRole('menuitem', { name: /delete/i });
      if (await deleteOption.isVisible()) {
        await deleteOption.click();
      }
    }

    // Confirm deletion if dialog appears
    const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Folder should no longer be visible
    await expect(page.getByRole('heading', { name: folderName })).not.toBeVisible({ timeout: 5000 });
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
    await page.getByRole('heading', { name: folderName }).click();

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
    await page.getByRole('heading', { name: folderName }).click();

    // Create new query
    await page.getByRole('button', { name: /new query/i }).click();

    // Wait for editor
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });

    // Enter SQL but leave title empty
    const monacoContainer = page.locator('.monaco-editor');
    await monacoContainer.click();
    await page.keyboard.type('SELECT 1;');

    // Try to save without title
    await page.getByRole('button', { name: /save/i }).click();

    // Should show validation error or prevent save
    const titleInput = page.getByLabel(/title/i);
    const isInvalid = await titleInput.getAttribute('aria-invalid');
    const hasError = await page.getByText(/title.*required|required.*title/i).isVisible().catch(() => false);

    expect(isInvalid === 'true' || hasError).toBe(true);
  });
});

test.describe('Query Status Transitions', () => {
  test('query starts as draft', async ({ page }) => {
    const testUser = generateTestUser('status');
    await signUp(page, testUser);
    await waitForDashboard(page);

    const folderName = `Status Test ${Date.now()}`;
    await createFolder(page, folderName);
    await page.getByRole('heading', { name: folderName }).click();

    // Create new query
    await page.getByRole('button', { name: /new query/i }).click();
    await page.getByLabel(/title/i).fill('Status Test Query');

    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 30000 });
    const monacoContainer = page.locator('.monaco-editor');
    await monacoContainer.waitFor({ state: 'visible', timeout: 10000 });
    await monacoContainer.click();
    await page.keyboard.type('SELECT 1;');

    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/draft|saved/i)).toBeVisible({ timeout: 5000 });

    // Verify status badge shows draft
    const statusBadge = page.getByText(/draft/i);
    await expect(statusBadge).toBeVisible();
  });
});
