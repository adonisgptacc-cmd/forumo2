import { ForumoApiClient, getApiBaseUrl } from "@forumo/shared";
import type {
  CreateListingDto,
  CreateOrderDto,
  SafeListing,
  SafeOrder,
} from "@forumo/shared";

export function createAuthenticatedClient(token: string): ForumoApiClient {
  return new ForumoApiClient({
    baseUrl: getApiBaseUrl(),
    getAccessToken: () => token,
  });
}

export async function seedListing(
  token: string,
  overrides: Partial<CreateListingDto> = {},
): Promise<SafeListing> {
  const api = createAuthenticatedClient(token);
  const payload: CreateListingDto = {
    title: overrides.title ?? `E2E Listing ${Date.now()}`,
    description:
      overrides.description ?? "E2E seeded listing — automated test data.",
    priceCents: overrides.priceCents ?? 2500,
    currency: overrides.currency ?? "USD",
    location: overrides.location ?? "Test City",
    status: overrides.status ?? "PUBLISHED",
    ...overrides,
  };
  return api.listings.create(payload);
}

export async function seedOrder(
  token: string,
  payload: CreateOrderDto,
): Promise<SafeOrder> {
  const api = createAuthenticatedClient(token);
  return api.orders.create(payload);
}

export type DataFixtures = {
  seedListing: (overrides?: Partial<CreateListingDto>) => Promise<SafeListing>;
  seedOrder: (payload: CreateOrderDto) => Promise<SafeOrder>;
};
