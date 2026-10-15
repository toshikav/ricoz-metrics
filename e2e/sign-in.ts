import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { demoSteward } from '../backend/src/demoAccount.js';
export async function signIn(page: Page) {
  await page.goto('/overview');
  await page.getByLabel('Email').fill(demoSteward.email);
  await page.getByLabel('Password').fill(demoSteward.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}
export async function signInApi(request: APIRequestContext) {
  const response = await request.post('http://localhost:5000/api/v1/auth/login', {
    data: { email: demoSteward.email, password: demoSteward.password },
  });
  expect(response.ok()).toBeTruthy();
}
