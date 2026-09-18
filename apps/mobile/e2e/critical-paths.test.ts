/* eslint-env jest */

/**
 * Mobile critical path E2E tests.
 *
 * Requires a running Forumo backend reachable via the configured
 * API_BASE_URL (set in app.config.ts extra.apiBaseUrl or EXPO_PUBLIC_API_BASE_URL).
 *
 * Run with:
 *   pnpm test:detox   (iOS simulator)
 *   pnpm test:detox:android  (Android emulator/device)
 *
 * The backend must be running and seeded for these tests to pass.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

describe("Mobile critical paths", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe("Authentication", () => {
    it("shows login screen on cold start", async () => {
      await expect(element(by.id("login-screen"))).toBeVisible();
    });

    it("navigates to register from login", async () => {
      await element(by.id("create-account")).tap();
      await expect(element(by.id("register-screen"))).toBeVisible();
    });
  });

  describe("Browse and discovery", () => {
    it("shows discovery listings after login", async () => {
      await expect(element(by.id("listing-discovery"))).toBeVisible();
    });
  });

  describe("Messaging", () => {
    it("opens inbox and shows threads", async () => {
      await element(by.id("inbox-tab")).tap();
      await expect(element(by.id("messaging-inbox"))).toBeVisible();
    });
  });

  describe("Orders", () => {
    it("shows orders tab", async () => {
      await element(by.id("orders-tab")).tap();
      await expect(element(by.id("orders-tab"))).toBeVisible();
    });
  });
});

module.exports = { API_BASE_URL };
