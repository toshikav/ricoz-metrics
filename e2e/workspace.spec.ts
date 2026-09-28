import { test, expect } from '@playwright/test';
test('create, validate, edit, inspect history, compare SQL and delete through the browser', async ({
  page,
}) => {
  const name = 'browser_' + Date.now();
  await page.goto('/metrics/new');
  await page.getByLabel('Display name', { exact: true }).fill('Browser revenue');
  await page.getByLabel('Metric key', { exact: false }).fill(name);
  await page.getByLabel('Business description').fill('Revenue recorded for browser verification.');
  await page.getByLabel('Business domain').fill('Finance');
  await page
    .getByLabel('SQL definition', { exact: true })
    .fill('SELECT SUM(amount) AS revenue FROM orders');
  await page.getByLabel('Creator email').fill('owner@example.com');
  await page.getByLabel('Data steward').fill('steward@example.com');
  await page.getByRole('button', { name: 'Create metric', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Browser revenue', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Metric created.');
  await page.getByRole('link', { name: 'Edit definition' }).click();
  await page.getByLabel('Business description').fill('Clarified revenue definition.');
  await page.getByLabel('Your email').fill('editor@example.com');
  await page.getByLabel('Change summary').fill('Clarify business meaning');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Version 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Version history', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Clarify business meaning' })).toBeVisible();
  await page.getByRole('button', { name: 'Dependencies & impact', exact: true }).click();
  await expect(
    page.getByText('No circular dependencies detected.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Audit log', exact: true }).click();
  await expect(page.getByText('Before and after').first()).toBeVisible();
  await page.getByRole('button', { name: 'Delete metric', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Your email').fill('editor@example.com');
  await page.getByRole('dialog').getByRole('textbox').last().fill(name);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete metric', exact: true })
    .click();
  await expect(page).toHaveURL(/\/metrics$/);
  await page.goto('/sql');
  await page.getByLabel('SQL definition', { exact: true }).fill('SELECT * FROM orders');
  await page.getByRole('button', { name: 'Validate SQL', exact: true }).last().click();
  await expect(page.getByText('Valid SELECT statement', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Compare revisions' }).click();
  await page.getByLabel('Original SQL').fill('SELECT SUM(amount) FROM orders WHERE amount > 1');
  await page.getByLabel('Proposed SQL').fill('SELECT SUM(amount) FROM orders WHERE amount > 2');
  await page.getByRole('button', { name: 'Compare SQL', exact: true }).click();
  await expect(
    page
      .locator('.summary-text')
      .getByText('Potentially breaking changes detected.', { exact: false }),
  ).toBeVisible();
});
test('mobile navigation, empty catalogue and server error are usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/overview');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Metric catalogue' }).click();
  await expect(page.getByRole('heading', { name: 'Your shared metric dictionary.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.route('**/api/v1/metrics?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Database unavailable. Please retry.' } }),
    }),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Database unavailable');
});
