import { Page, expect } from '@playwright/test';

/**
 * Create a new folder from the dashboard
 */
export async function createFolder(
  page: Page,
  name: string,
  description?: string
): Promise<void> {
  // Click new folder button
  await page.getByRole('button', { name: /new folder/i }).click();

  // Wait for dialog
  await expect(page.getByRole('dialog')).toBeVisible();

  // Fill in form
  await page.getByLabel(/folder name/i).fill(name);
  if (description) {
    await page.getByLabel(/description/i).fill(description);
  }

  // Submit
  await page.getByRole('button', { name: /create folder/i }).click();

  // Wait for dialog to close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

  // Verify folder appears
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

/**
 * Navigate to a folder
 */
export async function openFolder(page: Page, folderName: string): Promise<void> {
  await page.getByRole('heading', { name: folderName }).click();
  await expect(page).toHaveURL(/\/folder\//);
}

/**
 * Create a new query in the current folder
 */
export async function createQuery(
  page: Page,
  title: string,
  sql: string = 'SELECT 1;'
): Promise<void> {
  // Click new query button
  await page.getByRole('button', { name: /new query/i }).click();

  // Wait for query editor page
  await expect(page).toHaveURL(/\/query\/(new|create)/);

  // Fill in query details
  await page.getByLabel(/title/i).fill(title);

  // Fill SQL in Monaco editor (if present)
  const monacoEditor = page.locator('.monaco-editor');
  if (await monacoEditor.isVisible()) {
    await monacoEditor.click();
    await page.keyboard.type(sql);
  }

  // Save the query
  await page.getByRole('button', { name: /save/i }).click();

  // Wait for save confirmation
  await expect(page.getByText(/saved|created/i)).toBeVisible({ timeout: 5000 });
}

/**
 * Submit a query for approval
 */
export async function submitForApproval(page: Page): Promise<void> {
  await page.getByRole('button', { name: /submit for approval/i }).click();
  // Wait for either pending state or auto-approval
  await expect(
    page.getByText(/pending approval|approved|auto-approved/i)
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Check if a query was auto-approved (no pending state)
 */
export async function isAutoApproved(page: Page): Promise<boolean> {
  // Check for approved status without pending
  const approvedText = page.getByText(/approved/i);
  const pendingText = page.getByText(/pending/i);

  const isApproved = await approvedText.isVisible().catch(() => false);
  const isPending = await pendingText.isVisible().catch(() => false);

  return isApproved && !isPending;
}

/**
 * Navigate to approvals page
 */
export async function goToApprovals(page: Page): Promise<void> {
  await page.getByRole('button', { name: /approvals needed/i }).click();
  await expect(page).toHaveURL(/\/approvals/);
}
