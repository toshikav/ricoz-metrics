import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('overview, editor and mobile view are accessible and fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The metric lifecycle' })).toBeVisible();
  await page.screenshot({ path: 'work/overview-desktop.png', fullPage: true });
  const overview = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(overview.violations).toEqual([]);
  await page.goto('/metrics/new');
  await expect(page.getByLabel('Display name', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'work/editor-desktop.png', fullPage: true });
  const editor = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(editor.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The metric lifecycle' })).toBeVisible();
  await page.screenshot({ path: 'work/overview-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
