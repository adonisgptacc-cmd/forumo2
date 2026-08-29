import { test as base, expect } from "@playwright/test";
import { ForumoApiClient, getApiBaseUrl } from "@forumo/shared";

export interface AuthenticatedUser {
  email: string;
  phone: string;
  password: string;
  token: string;
  userId?: string;
  twoFactorToken?: string;
}

type AuthFixtures = {
  authenticatedUser: AuthenticatedUser;
};

function isTwoFactorRequired(
  value: unknown,
): value is { twoFactorRequired: true; twoFactorToken: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "twoFactorRequired" in value &&
    (value as Record<string, unknown>).twoFactorRequired === true
  );
}

function isTwoFactorSetupRequired(
  value: unknown,
): value is { twoFactorSetupRequired: true; twoFactorToken: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "twoFactorSetupRequired" in value &&
    (value as Record<string, unknown>).twoFactorSetupRequired === true
  );
}

export const test = base.extend<AuthFixtures>({
  authenticatedUser: async ({}, use) => {
    const suffix = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).slice(2, 6);
    const email = `e2e-${suffix}-${random}@test.com`;
    const phone = `+1555${Date.now().toString().slice(-7)}`;
    const password = "Test123!@#";
    const name = "E2E User";

    const api = new ForumoApiClient({ baseUrl: getApiBaseUrl() });

    await api.auth.register({ name, email, phone, password });

    const login = await api.auth.login({ email, password });

    let token: string;
    let twoFactorToken: string | undefined;

    if (isTwoFactorRequired(login) || isTwoFactorSetupRequired(login)) {
      twoFactorToken = (login as { twoFactorToken: string }).twoFactorToken;
      token = twoFactorToken;
    } else {
      token = (login as { accessToken: string }).accessToken;
    }

    const userId = (login as { user?: { id: string } })?.user?.id;

    await use({ email, phone, password, token, userId, twoFactorToken });
  },
});

export { expect };
