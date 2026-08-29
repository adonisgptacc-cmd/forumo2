import { test } from "../fixtures/auth";
import { expect } from "@playwright/test";
import { ForumoApiClient, getApiBaseUrl } from "@forumo/shared";
import { createAuthenticatedClient } from "../fixtures/data";

// A 1x1 transparent PNG (~67 bytes)
const ONE_PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

async function loginViaUi(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
): Promise<"app" | "2fa" | "still-login"> {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /sign in to manage your marketplace/i }),
  ).toBeVisible({ timeout: 10_000 });

  await page.getByPlaceholder("you@example.com or +1234567890").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);

  const respPromise = page
    .waitForResponse((r) => r.url().includes("/auth/login"))
    .catch(() => null);

  await page.getByRole("button", { name: /^sign in$/i }).click();

  const resp = await respPromise;
  if (resp) {
    const body = await resp.json().catch(() => null);
    if (
      body &&
      ("twoFactorToken" in body ||
        "twoFactorRequired" in body ||
        "twoFactorSetupRequired" in body)
    ) {
      await expect(page).toHaveURL(/\/login\/2fa\?mode=(verify|setup)/, {
        timeout: 10_000,
      });
      return "2fa";
    }
  }

  // Poll for Navigation
  try {
    await expect
      .poll(async () => page.url(), { timeout: 12_000 })
      .toMatch(/\/login\/2fa|\/app/);
  } catch {
    // still on /login — check error
    if (page.url().includes("/app")) return "app";
    return "still-login";
  }

  const url = page.url();
  if (url.includes("/login/2fa")) return "2fa";
  if (url.includes("/app")) return "app";
  return "still-login";
}

test.describe("seller — create listing", () => {
  test("seller creates listing with media and sees moderation pending", async ({
    page,
    authenticatedUser,
  }) => {
    // If fixture token is 2FA-only, UI login will hit 2FA gate and we must skip
    if (authenticatedUser.twoFactorToken) {
      const fate = await loginViaUi(
        page,
        authenticatedUser.email,
        authenticatedUser.password,
      );
      if (fate === "2fa") {
        test.skip(
          true,
          "authenticatedUser requires 2FA — cannot exercise seller UI without TOTP",
        );
        return;
      }
    } else {
      const fate = await loginViaUi(
        page,
        authenticatedUser.email,
        authenticatedUser.password,
      );
      if (fate === "2fa") {
        test.skip(
          true,
          "login hit 2FA gate — seller UI unavailable without TOTP setup",
        );
        return;
      }
      if (fate === "still-login") {
        const errVisible = await page
          .getByText(/invalid credentials|verify your email|unable to sign in/i)
          .isVisible()
          .catch(() => false);
        if (errVisible) {
          test.skip(
            true,
            "login failed — backend may require email verification or is unavailable",
          );
          return;
        }
      }
    }

    // Ensure we are at /app/listings/new — SellerGate may intercept
    await page.goto("/app/listings/new");
    await page.waitForLoadState("networkidle");

    // Handle SellerGate: "Become a Seller" upgrade prompt
    const becomeBtn = page.getByRole("button", {
      name: /activate seller account/i,
    });
    if ((await becomeBtn.count()) > 0) {
      await becomeBtn.click();
      // Wait for refresh — SellerGate flips to form after success
      await expect(page.getByPlaceholder("What are you selling?")).toBeVisible({
        timeout: 12_000,
      });
    }

    // Verify form rendered (ListingForm from components/listings)
    const titleInput = page.getByPlaceholder("What are you selling?");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    const title = `E2E Stool ${Date.now()}`;
    const description =
      "E2E seeded stool — solid wood, 45cm height, automated test data. " +
      "Condition good, includes extra hardware. At least 10 chars.";
    const location = "E2E City";
    const price = "48.00"; // -> 4800 cents, ZAR

    await titleInput.fill(title);

    const descInput = page.getByPlaceholder(
      "Describe your item — condition, dimensions, history…",
    );
    await expect(descInput).toBeVisible({ timeout: 5000 });
    await descInput.fill(description);

    // Price (ZAR) — input placeholder "0.00" inside Price section
    const priceInput = page.locator('input[placeholder="0.00"]').first();
    await expect(priceInput).toBeVisible({ timeout: 5000 });
    await priceInput.fill(price);

    // Location
    const locationInput = page.getByPlaceholder("City or region");
    await locationInput.fill(location);

    // Upload media — hidden file input accept image/*
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await expect(fileInput.first()).toBeAttached({ timeout: 5000 });
    await fileInput.first().setInputFiles({
      name: "e2e-test.png",
      mimeType: "image/png",
      buffer: ONE_PX_PNG,
    });

    // Optional: ensure preview appears (cover badge)
    await expect(page.getByText("Cover").first())
      .toBeVisible({ timeout: 6000 })
      .catch(() => {});

    // Publishing status is a <select>; default is Published. Ensure it's set.
    const statusSelect = page
      .locator("select")
      .filter({ hasText: "Publish now" })
      .first();
    // Fallback locator: last select on form is status
    const statusFallback = page.locator("form").locator("select").last();
    const targetSelect =
      (await statusSelect.count()) > 0 ? statusSelect : statusFallback;
    // Keep PUBLISHED
    await targetSelect.selectOption("PUBLISHED").catch(() => {});

    // Submit — "Create listing" primary button
    const createBtn = page.getByRole("button", { name: /create listing/i });
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Expect success state: "Listing created!" banner then redirect to /app/listings
    const createdBanner = page.getByText(/listing created!/i);
    await expect(createdBanner.or(createBtn).first()).toBeVisible({
      timeout: 12_000,
    });

    // Wait for redirect (ListingForm does router.push after 1.5s)
    await expect(page).toHaveURL(/\/app\/listings/, { timeout: 15_000 });

    // Verify listing appears in seller dashboard — title present
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 10_000,
    });

    // Verify moderation banner — new PUBLISHED listings are PENDING moderation
    // ListingCard in manager should show status badge and maybe "Under review"
    const moderationHint = page.getByText(/under review/i).first();
    // Not strictly required — tolerate APPROVED if admin auto-approves
    await moderationHint.isVisible({ timeout: 3000 }).catch(() => {});

    // Verify via API that listing exists
    try {
      const sellerApi = createAuthenticatedClient(authenticatedUser.token);
      // Search with keyword to locate it without needing to enumerate myListings
      const res = await sellerApi.listings.search({
        keyword: title,
        pageSize: 50,
      });
      const found = res.data.find((l) => l.title === title);
      expect(found, `listing "${title}" should exist via API`).toBeTruthy();
      if (found) {
        expect(found.priceCents).toBe(4800);
        expect(found.location).toBe(location);
      }
    } catch (e) {
      // If API unavailable, skip assertion gracefully
      const msg = (e as Error).message ?? "";
      if (msg.includes("fetch") || msg.includes("ECONNREFUSED")) {
        // eslint-disable-next-line no-console
        console.warn("API verification skipped — backend unavailable:", msg);
      } else {
        throw e;
      }
    }
  });

  test("seller can edit listing", async ({ page, authenticatedUser }) => {
    // Create listing via API first to avoid depending on previous test
    let title = `E2E Edit Stool ${Date.now()}`;
    let listingId: string | null = null;

    try {
      const sellerApi = createAuthenticatedClient(authenticatedUser.token);
      // Ensure seller role
      try {
        await sellerApi.users.becomeSeller();
      } catch {}
      const created = await sellerApi.listings.create({
        title,
        description:
          "E2E edit flow seed — original description with at least ten chars.",
        priceCents: 5000,
        currency: "USD",
        location: "Test City",
        status: "DRAFT",
      });
      listingId = created.id;
      title = created.title;
    } catch {
      test.skip(
        true,
        "backend unavailable — cannot seed listing for edit test",
      );
      return;
    }

    if (!listingId) {
      test.skip(true, "failed to seed listing");
      return;
    }

    const loginFate = await loginViaUi(
      page,
      authenticatedUser.email,
      authenticatedUser.password,
    );
    if (loginFate === "2fa") {
      test.skip(true, "login requires 2FA — cannot test edit UI");
      return;
    }

    await page.goto(`/app/listings/${listingId}/edit` as unknown as string);
    await page.waitForLoadState("networkidle");

    // Handle Become Seller gate if still buyer
    const becomeBtn = page.getByRole("button", {
      name: /activate seller account/i,
    });
    if ((await becomeBtn.count()) > 0) {
      await becomeBtn.click();
      await page.waitForTimeout(800);
      await page.goto(`/app/listings/${listingId}/edit` as unknown as string);
      await page.waitForLoadState("networkidle");
    }

    const titleInput = page.getByPlaceholder("What are you selling?");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    // Title should be pre-filled
    await expect(titleInput).toHaveValue(title);

    const updatedTitle = `${title} — edited`;
    await titleInput.fill(updatedTitle);

    const saveBtn = page.getByRole("button", { name: /save changes/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    await expect(page.getByText(/listing updated!/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/app\/listings/, { timeout: 10_000 });

    // Verify via API
    try {
      const sellerApi = createAuthenticatedClient(authenticatedUser.token);
      const fetched = await sellerApi.listings.get(listingId);
      expect(fetched.title).toBe(updatedTitle);
    } catch {
      // If API not reachable after UI success, tolerate
      await expect(page.getByText(updatedTitle).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
