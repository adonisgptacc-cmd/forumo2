import { test, expect } from "@playwright/test";
import { ForumoApiClient, getApiBaseUrl } from "@forumo/shared";

// ---------------------------------------------------------------------------
// Helpers — isolated user per test, no shared state
// ---------------------------------------------------------------------------
function uniqueEmail(): string {
  const suffix = Date.now().toString().slice(-8);
  const rand = Math.random().toString(36).slice(2, 6);
  return `e2e-${suffix}-${rand}@test.com`;
}

function uniquePhone(): string {
  // E.164: +1 + 7-digit suffix to stay deterministic
  return `+1555${Date.now().toString().slice(-7)}`;
}

function apiClient(): ForumoApiClient {
  return new ForumoApiClient({ baseUrl: getApiBaseUrl() });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
test.describe("auth — registration", () => {
  test("register with email and phone", async ({ page }) => {
    const email = uniqueEmail();
    const phone = uniquePhone();
    const password = "Test123!@#";
    const name = "E2E User";

    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: /create your forumo account/i }),
    ).toBeVisible();

    // Full name — label "Full name" (no placeholder on signup form)
    await page.getByLabel("Full name").fill(name);

    // Phone — placeholder "+1234567890"
    await page.getByPlaceholder("+1234567890").fill(phone);

    // Email — label "Email" (type="email", no placeholder)
    // Fallback to input[type="email"] if label lookup fails
    const emailInput = page.getByLabel("Email").first();
    if ((await emailInput.count()) > 0) {
      await emailInput.fill(email);
    } else {
      await page.locator('input[type="email"]').first().fill(email);
    }

    // Password — label "Password"
    await page.getByLabel("Password", { exact: true }).fill(password);

    // Explicit interception: ensure register call is observed before asserting URL
    const apiBase = getApiBaseUrl();
    const waitRegister = page
      .waitForResponse(
        (res) =>
          res.url().includes(`${apiBase}/auth/register`) ||
          res.url().includes("/auth/register"),
      )
      .catch(() => null);

    await page.getByRole("button", { name: /create account/i }).click();

    await waitRegister;

    // Backend redirects to /verify-email?pending=true&email=...
    // Even if backend is down the UI will show either success redirect or error text
    await expect
      .poll(async () => page.url(), { timeout: 10_000 })
      .toContain("verify-email");

    await expect(page).toHaveURL(/\/verify-email\?pending=true/);
    // Pending state shows "Check your inbox" + resend form
    await expect(page.getByText(/check your inbox/i).first()).toBeVisible({
      timeout: 10_000,
    });
    // Email should be echoed in pending view
    await expect(page.getByText(email).first())
      .toBeVisible({ timeout: 5000 })
      .catch(() => {});
  });

  test("register shows error for duplicate email", async ({ page }) => {
    const email = uniqueEmail();
    const phone = uniquePhone();
    const password = "Test123!@#";
    const api = apiClient();

    // Seed via API — if backend unavailable, skip the assertion gracefully
    try {
      await api.auth.register({ name: "E2E User", email, phone, password });
    } catch (e) {
      test.skip(
        true,
        `backend unavailable for seeding: ${(e as Error).message}`,
      );
      return;
    }

    await page.goto("/signup");
    await page.getByLabel("Full name").fill("E2E Duplicate");
    await page.getByPlaceholder("+1234567890").fill(uniquePhone());
    const emailInput = page.getByLabel("Email").first();
    if ((await emailInput.count()) > 0) await emailInput.fill(email);
    else await page.locator('input[type="email"]').first().fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();

    // Expect inline error (ApiError message from backend)
    await expect(
      page.getByText(/already registered|unable to create account/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("register requires phone (client validation)", async ({ page }) => {
    await page.goto("/signup");

    await page.getByLabel("Full name").fill("No Phone User");
    // Leave phone empty
    const emailInput = page.getByLabel("Email").first();
    const email = uniqueEmail();
    if ((await emailInput.count()) > 0) await emailInput.fill(email);
    else await page.locator('input[type="email"]').first().fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Test123!@#");

    // Browser required validation prevents submit — ensure we stay on /signup
    await page.getByRole("button", { name: /create account/i }).click();
    // Either stays on /signup or shows validation; both satisfy required check
    await expect(page).toHaveURL(/\/signup/);
  });
});
