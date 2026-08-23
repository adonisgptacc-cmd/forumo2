import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  ForumoApiClient,
  getApiBaseUrl,
  getGatewayBaseUrl,
} from "./api-client";

describe("getApiBaseUrl", () => {
  it("appends /api/v1 to an origin-only URL", () => {
    expect(getApiBaseUrl("http://localhost:4000")).toBe(
      "http://localhost:4000/api/v1",
    );
  });

  it("appends /v1 to a URL that already ends in /api", () => {
    expect(getApiBaseUrl("http://localhost:4000/api")).toBe(
      "http://localhost:4000/api/v1",
    );
  });

  it("leaves an already-versioned URL unchanged", () => {
    expect(getApiBaseUrl("http://localhost:4000/api/v1")).toBe(
      "http://localhost:4000/api/v1",
    );
  });

  it("strips a trailing slash before normalizing", () => {
    expect(getApiBaseUrl("http://localhost:4000/api/v1/")).toBe(
      "http://localhost:4000/api/v1",
    );
  });

  it("falls back to the localhost default when nothing is provided", () => {
    expect(getApiBaseUrl(null)).toBe("http://localhost:4000/api/v1");
  });
});

describe("getGatewayBaseUrl", () => {
  it("strips the /api/v1 suffix for a non-versioned gateway (e.g. WebSocket) base", () => {
    expect(getGatewayBaseUrl("http://localhost:4000")).toBe(
      "http://localhost:4000",
    );
  });

  it("strips /api/v1 from an already-versioned URL", () => {
    expect(getGatewayBaseUrl("http://localhost:4000/api/v1")).toBe(
      "http://localhost:4000",
    );
  });
});

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

describe("ForumoApiClient", () => {
  it("normalizes the base URL and sends GET requests without a content type", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ healthy: true }));
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com/",
      fetchImpl,
    });

    await expect(client.get<{ healthy: boolean }>("/health")).resolves.toEqual({
      healthy: true,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.com/health");
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });

  it("serializes JSON request bodies and preserves caller headers", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ id: "listing-1" }));
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    await client.post(
      "/listings",
      { title: "Desk lamp" },
      { headers: { "X-Request-Id": "request-1" } },
    );

    const [, init] = fetchImpl.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(init?.body).toBe(JSON.stringify({ title: "Desk lamp" }));
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-Request-Id")).toBe("request-1");
  });

  it("resolves a fresh access token for authenticated requests", async () => {
    const getAccessToken = vi.fn().mockResolvedValue("access-token");
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ id: "user-1" }));
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
      getAccessToken,
    });

    await client.get("/auth/me", { auth: true });

    expect(getAccessToken).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer access-token",
    );
  });

  it("does not request or send an access token for public calls", async () => {
    const getAccessToken = vi.fn().mockReturnValue("access-token");
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
      getAccessToken,
    });

    await client.get("/listings");

    expect(getAccessToken).not.toHaveBeenCalled();
    const [, init] = fetchImpl.mock.calls[0];
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });

  it("passes FormData through without forcing a JSON content type", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ uploaded: true }));
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });
    const form = new FormData();
    form.append("file", new Blob(["image"]), "listing.txt");

    await client.post("/uploads", form);

    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.body).toBe(form);
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });

  it("throws an ApiError with the server message and response details", async () => {
    const details = { message: "Listing not found", code: "LISTING_NOT_FOUND" };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(details, { status: 404, statusText: "Not Found" }),
      );
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    const request = client.get("/listings/missing");

    await expect(request).rejects.toMatchObject({
      name: "ApiError",
      message: "Listing not found",
      status: 404,
      details,
    } satisfies Partial<ApiError>);
  });

  it("falls back to the HTTP status text for non-JSON errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("upstream unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      }),
    );
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    await expect(client.get("/health")).rejects.toMatchObject({
      message: "Service Unavailable",
      status: 503,
      details: "upstream unavailable",
    });
  });

  it("returns undefined for successful responses without a body", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    await expect(client.delete("/notifications/all")).resolves.toBeUndefined();
  });

  it("builds listing search queries and parses numeric pagination fields", async () => {
    const listing = {
      id: "listing-1",
      sellerId: "seller-1",
      title: "Desk lamp",
      description: "A brass desk lamp",
      priceCents: 4500,
      currency: "USD",
      status: "PUBLISHED",
      createdAt: "2026-07-30T08:00:00.000Z",
      updatedAt: "2026-07-30T08:00:00.000Z",
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [listing],
        total: "1",
        page: "2",
        pageSize: "10",
        pageCount: "1",
      }),
    );
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    const result = await client.listings.search({
      keyword: "lamp",
      page: 2,
      pageSize: 10,
      tags: ["vintage", "lighting"],
      categories: ["home"],
    });

    const [url] = fetchImpl.mock.calls[0];
    const requestUrl = new URL(String(url));
    expect(requestUrl.pathname).toBe("/listings/search");
    expect(requestUrl.searchParams.get("keyword")).toBe("lamp");
    expect(requestUrl.searchParams.getAll("tags")).toEqual([
      "vintage",
      "lighting",
    ]);
    expect(requestUrl.searchParams.getAll("categories")).toEqual(["home"]);
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 10,
      pageCount: 1,
    });
    expect(result.data[0]).toMatchObject({ variants: [], images: [] });
  });

  it("rejects listing responses that violate the public response schema", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ id: "listing-without-required-fields" }],
        total: 1,
        page: 1,
        pageSize: 12,
        pageCount: 1,
      }),
    );
    const client = new ForumoApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    await expect(client.listings.search()).rejects.toMatchObject({
      name: "ZodError",
    });
  });
});
