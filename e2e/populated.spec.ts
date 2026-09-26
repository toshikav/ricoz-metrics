import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('populated catalogue, certification and dependency views use real API data', async ({
  page,
  request,
}) => {
  const root = 'http://localhost:5000/api/v1',
    suffix = String(Date.now());
  const records: any[] = [];
  async function create(
    name: string,
    title: string,
    domain: string,
    sql: string,
    deps: string[] = [],
  ) {
    const r = await request.post(root + '/metrics', {
      data: {
        name: name + '_' + suffix,
        display_name: title,
        description: 'Verification fixture for ' + title.toLowerCase() + '.',
        metric_type: deps.length ? 'RATIO' : 'BASE',
        domain,
        operational_tier: 'HIGH',
        calculation_logic: {
          sql_template: sql,
          dependencies: deps,
          parameters: {},
          aggregation: deps.length ? 'custom' : 'sum',
        },
        created_by: 'owner@example.com',
        steward: 'Finance team',
        tags: ['verification'],
      },
    });
    expect(r.status()).toBe(201);
    const m = (await r.json()).data;
    records.push(m);
    return m;
  }
  async function update(m: any, patch: any) {
    const r = await request.put(root + '/metrics/' + m._id, {
      data: {
        ...patch,
        updated_by: 'steward@example.com',
        changes_summary: 'Review fixture definition',
        expected_version: m.version,
      },
    });
    expect(r.status()).toBe(200);
    Object.assign(m, (await r.json()).data);
  }
  try {
    const revenue = await create(
      'gross_revenue',
      'Gross revenue',
      'Finance',
      'SELECT SUM(amount) AS revenue FROM orders',
    );
    const orders = await create(
      'completed_orders',
      'Completed orders',
      'Commerce',
      "SELECT COUNT(id) AS orders FROM orders WHERE status = 'completed'",
    );
    const ratio = await create(
      'average_order_value',
      'Average order value',
      'Commerce',
      'SELECT ${' + revenue.name + '} / NULLIF(${' + orders.name + '}, 0) AS value',
      [revenue.name, orders.name],
    );
    await update(revenue, { state: 'IN_REVIEW' });
    await update(revenue, { state: 'CERTIFIED' });
    await update(orders, {
      calculation_logic: {
        sql_template: "SELECT COUNT(id) AS orders FROM orders WHERE status = 'paid'",
      },
    });
    await update(orders, { state: 'IN_REVIEW' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'The metric lifecycle' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gross revenue', exact: true })).toBeVisible();
    await page.screenshot({ path: 'work/populated-overview.png', fullPage: true });
    const overview = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      overview.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.goto('/metrics?domain=Finance');
    await expect(page.getByRole('link', { name: 'Gross revenue', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Completed orders', exact: true })).toHaveCount(0);
    await page.goto('/metrics/' + ratio._id);
    await page.getByRole('button', { name: 'Dependencies & impact' }).click();
    await expect(page.getByRole('link', { name: revenue.name, exact: true })).toBeVisible();
    await page.screenshot({ path: 'work/dependencies-desktop.png', fullPage: true });
    const detail = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      detail.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.sidebar')).not.toBeInViewport();
    await page.screenshot({ path: 'work/dependencies-mobile.png', fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    for (const m of records.reverse()) {
      if (m.state === 'CERTIFIED') await update(m, { state: 'DEPRECATED' });
      const r = await request.delete(root + '/metrics/' + m._id, {
        data: { deleted_by: 'owner@example.com', expected_version: m.version },
      });
      expect(r.status()).toBe(200);
    }
  }
});
