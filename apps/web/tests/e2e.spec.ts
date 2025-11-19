import { expect, test } from '@playwright/test';

async function waitForDashboard(page: import('@playwright/test').Page) {
  await expect(page.getByText('Control center')).toBeVisible();
}

test('signup → create listing → checkout happy path', async ({ page }) => {
  const uniqueEmail = `test+${Date.now()}@forumo.dev`;
  const password = 'password123';
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('QA Seller');
  await page.getByLabel('Phone').fill('+233555555555');
  await page.getByLabel('Email').fill(uniqueEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.goto('/login');
  await page.getByLabel('Email').fill(uniqueEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL('**/app', { timeout: 15000 });
  await waitForDashboard(page);

  await page.goto('/listings/new');
  await page.getByLabel('Seller ID *').fill('mock-user');
  await page.getByLabel('Title *').fill('Test Listing');
  await page.getByLabel('Description *').fill('Handmade artifact for QA.');
  await page.getByLabel('Price (in USD) *').fill('42');
  await page.getByLabel('Location').fill('Accra');
  await page.getByRole('button', { name: 'Create listing' }).click();

  await page.waitForURL(
    (url) => url.pathname.startsWith('/listings/') && url.pathname !== '/listings/new',
    { timeout: 20000 },
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Test Listing' })).toBeVisible();
  const listingId = page.url().split('/').pop() as string;

  await page.goto('/app/checkout');
  await page.getByLabel('Buyer ID').fill('buyer-test');
  await page.getByLabel('Seller ID').fill('mock-user');
  await page.waitForSelector(`select option[value="${listingId}"]`, { state: 'attached' });
  await page.getByLabel('Listing').selectOption(listingId);
  await page.getByRole('button', { name: 'Place escrow order' }).click();
  await expect(page.getByText(/Order .* created/)).toBeVisible();
});
