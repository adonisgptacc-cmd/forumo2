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

test("signup → create listing → checkout happy path", async ({ page }) => {
  const uniqueEmail = `test+${Date.now()}@forumo.dev`;
  const password = "password123";
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("QA Seller");
  await page.getByLabel("Phone").fill("+233555555555");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("**/app", { timeout: 15000 });
  await waitForDashboard(page);
  await acceptCookies(page);

  await page.goto("/app/profile");
  await page.getByRole("button", { name: "+ Add address" }).click();
  await page.getByPlaceholder("Full name *").fill("QA Seller");
  await page.getByPlaceholder("Street address *").fill("1 Market Street");
  await page.getByPlaceholder("City *").fill("Accra");
  await page.getByPlaceholder("Country *").fill("Ghana");
  await page.getByRole("checkbox", { name: "Set as default" }).check();
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("1 Market Street")).toBeVisible();

  await page.goto("/app/listings/new");
  await page.getByPlaceholder("What are you selling?").fill("Test Listing");
  await page
    .getByPlaceholder("Describe your item — condition, dimensions, history…")
    .fill("Handmade artifact for QA.");
  await page.getByPlaceholder("0.00").fill("42");
  await page.getByPlaceholder("City or region").fill("Accra");
  await page.getByRole("button", { name: "Create listing" }).click();

  await page.waitForURL("**/app/listings", { timeout: 20000 });
  await expect(page.getByText("Test Listing")).toBeVisible();

  await page.goto("/listings");
  await page.getByRole("link", { name: /Test Listing/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Test Listing" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buy Now" }).click();
  await expect(page).toHaveURL(/\/app\/checkout/);
  await expect(page.getByRole("heading", { name: "Shipping" })).toBeVisible();
  await page.getByRole("button", { name: /Continue to Payment/ }).click();
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
});
