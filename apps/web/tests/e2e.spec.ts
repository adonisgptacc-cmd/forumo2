import { expect, test } from "@playwright/test";

async function waitForDashboard(page: import("@playwright/test").Page) {
  await expect(page.getByText("Control center")).toBeVisible();
}

async function acceptCookies(page: import("@playwright/test").Page) {
  const acceptAll = page.getByRole("button", { name: "Accept All" });
  if (await acceptAll.isVisible()) {
    await acceptAll.click();
  }
}

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  const [callbackResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/callback/token-auth") &&
        response.ok(),
    ),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);

  expect(callbackResponse.ok()).toBe(true);
  await page.goto("/app");
  await waitForDashboard(page);
}

test("create listing → checkout happy path", async ({ page }) => {
  const uniqueSeed = Date.now().toString();
  const listingTitle = `Test Listing ${uniqueSeed}`;

  await login(page, "seller@example.com", "password");
  await acceptCookies(page);

  await page.goto("/app/profile");
  const addAddress = page.getByRole("button", { name: "+ Add address" });
  const fullName = page.getByPlaceholder("Full name *");
  await expect(async () => {
    await addAddress.click();
    await expect(fullName).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
  await fullName.fill("QA Buyer");
  await page.getByPlaceholder("Street address *").fill("1 Market Street");
  await page.getByPlaceholder("City *").fill("Accra");
  await page.getByPlaceholder("Country *").fill("Ghana");
  await page.getByRole("checkbox", { name: "Set as default" }).check();
  await expect(
    page.getByRole("button", { name: "Save address" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("1 Market Street")).toBeVisible();

  await page.getByRole("link", { name: "My Listings" }).click();
  await expect(page).toHaveURL(/\/app\/listings$/);
  await page.getByRole("link", { name: "+ New listing" }).click();
  await expect(page).toHaveURL(/\/app\/listings\/new$/);
  await page.getByPlaceholder("What are you selling?").fill(listingTitle);
  await page
    .getByPlaceholder("Describe your item — condition, dimensions, history…")
    .fill("Handmade artifact for QA.");
  await page.getByPlaceholder("0.00").fill("42");
  await page.getByPlaceholder("City or region").fill("Accra");
  await page.getByRole("button", { name: "Create listing" }).click();

  await expect(page.getByText("Listing created!")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/listings$/, { timeout: 60000 });
  await expect(page.getByText(listingTitle)).toBeVisible();

  await page.getByRole("link", { name: "All Listings" }).click();
  await expect(page).toHaveURL(/\/listings$/);
  await page.getByRole("link", { name: listingTitle }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: listingTitle }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buy Now" }).click();
  await expect(page).toHaveURL(/\/app\/checkout/);
  await expect(page.getByRole("heading", { name: "Shipping" })).toBeVisible();
  await page.getByRole("button", { name: /Continue to Payment/ }).click();
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
});
