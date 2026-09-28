import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing works without the API, explains the product and opens the workspace', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  await page.route('http://localhost:5000/**', (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Every metric.One clear meaning.',
  );
  await expect(page.getByText('ILLUSTRATIVE EXAMPLE')).toBeVisible();
  await page
    .locator('summary')
    .filter({ hasText: 'Does it calculate revenue or run reports?' })
    .click();
  await expect(
    page.getByText('No. The workspace stores metric definitions', { exact: false }),
  ).toBeVisible();
  await page.screenshot({ path: 'work/landing-desktop.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'work/landing-mobile.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(apiRequests).toEqual([]);
  await page.unroute('http://localhost:5000/**');
  await page.getByRole('link', { name: 'Open workspace' }).first().click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { name: 'The metric lifecycle' })).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'RicozMetrics METRIC GOVERNANCE' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
});
