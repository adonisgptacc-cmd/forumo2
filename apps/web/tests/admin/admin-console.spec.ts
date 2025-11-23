import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page, email: string, password: string, callbackUrl = '/app') {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('unauthenticated visitors are redirected away from admin surfaces', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});

test('non-privileged users see an authorization error', async ({ page }) => {
  await login(page, 'seller@example.com', 'password', '/admin');
  await page.waitForURL(/\/unauthorized/);
  await expect(page.getByRole('heading', { name: 'You need elevated privileges' })).toBeVisible();
});

test('admins can process KYC, listing moderation, and dispute workflows', async ({ page }) => {
  await login(page, 'admin@example.com', 'password', '/admin');
  await page.waitForURL(/\/admin/);

  await page.goto('/admin/kyc');
  await page.getByRole('button', { name: 'Approve verification' }).click();
  await expect(page.getByText('APPROVED')).toBeVisible();

  await page.goto('/admin/moderations');
  await page.getByRole('button', { name: 'Approve listing' }).click();
  await expect(page.getByText('APPROVED')).toBeVisible();

  await page.goto('/admin/disputes');
  await page.getByRole('button', { name: 'Move to review' }).click();
  await expect(page.getByText('UNDER_REVIEW')).toBeVisible();
  await page.getByPlaceholder('Resolution notes').fill('Customer refunded after evidence review.');
  await page.getByRole('button', { name: 'Resolve dispute' }).click();
  await expect(page.getByText('RESOLVED')).toBeVisible();
});
