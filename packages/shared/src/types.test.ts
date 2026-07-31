import { describe, expect, it } from "vitest";

import {
  createListingSchema,
  createOrderSchema,
  listingImageSchema,
  listingSearchParamsSchema,
  registerPayloadSchema,
  safeListingSchema,
  safeUserSchema,
  sendMessageSchema,
} from "./types";

describe("shared domain schemas", () => {
  it("accepts a safe user and rejects invalid public identity fields", () => {
    const user = {
      id: "user-1",
      email: "buyer@example.com",
      name: null,
      role: "BUYER",
    };

    expect(safeUserSchema.parse(user)).toEqual(user);
    expect(
      safeUserSchema.safeParse({ ...user, email: "not-an-email" }).success,
    ).toBe(false);
    expect(
      safeUserSchema.safeParse({ ...user, role: "SUPER_ADMIN" }).success,
    ).toBe(false);
  });

  it("enforces registration password and email boundaries", () => {
    const validPassword = ["eight", "characters"].join("-");
    expect(
      registerPayloadSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: validPassword,
      }).success,
    ).toBe(true);
    expect(
      registerPayloadSchema.safeParse({
        name: "Ada",
        email: "ada.example.com",
        password: "short",
      }).success,
    ).toBe(false);
  });

  it("enforces listing creation price and content constraints", () => {
    const listing = {
      title: "Desk lamp",
      description: "A brass desk lamp in excellent condition.",
      priceCents: 4500,
    };

    expect(createListingSchema.safeParse(listing).success).toBe(true);
    expect(
      createListingSchema.safeParse({ ...listing, title: "No" }).success,
    ).toBe(false);
    expect(
      createListingSchema.safeParse({ ...listing, priceCents: 0 }).success,
    ).toBe(false);
  });

  it("applies stable defaults to listing response collections and image URLs", () => {
    const image = listingImageSchema.parse({
      id: "2ceba132-2979-45a7-87b1-10cc62c999f1",
    });
    const listing = safeListingSchema.parse({
      id: "listing-1",
      sellerId: "seller-1",
      title: "Desk lamp",
      description: "A brass desk lamp",
      priceCents: 4500,
      currency: "USD",
      status: "PUBLISHED",
      createdAt: "2026-07-30T08:00:00.000Z",
      updatedAt: "2026-07-30T08:00:00.000Z",
    });

    expect(image.url).toBe("");
    expect(listing.images).toEqual([]);
    expect(listing.variants).toEqual([]);
  });

  it("coerces and bounds listing pagination inputs", () => {
    expect(
      listingSearchParamsSchema.parse({ page: "2", pageSize: "25" }),
    ).toMatchObject({
      page: 2,
      pageSize: 25,
    });
    expect(listingSearchParamsSchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 12,
    });
    expect(listingSearchParamsSchema.safeParse({ page: 0 }).success).toBe(
      false,
    );
    expect(listingSearchParamsSchema.safeParse({ pageSize: 51 }).success).toBe(
      false,
    );
  });

  it("requires at least one valid order item and defaults currency", () => {
    const order = {
      buyerId: "3fd56530-151b-472c-95d6-0469014e72d4",
      sellerId: "28dc7870-c18f-416b-94ed-dff2c826e055",
      items: [
        {
          listingId: "f3d5e670-18af-4563-a327-a685486ce129",
          quantity: 1,
          unitPriceCents: 4500,
        },
      ],
    };

    expect(createOrderSchema.parse(order).currency).toBe("USD");
    expect(createOrderSchema.safeParse({ ...order, items: [] }).success).toBe(
      false,
    );
  });

  it("enforces non-empty message bodies and the public maximum length", () => {
    const authorId = "ae0b0608-7e3a-4fb4-9a8a-136230226a11";

    expect(
      sendMessageSchema.safeParse({ authorId, body: "Is this available?" })
        .success,
    ).toBe(true);
    expect(sendMessageSchema.safeParse({ authorId, body: "" }).success).toBe(
      false,
    );
    expect(
      sendMessageSchema.safeParse({ authorId, body: "x".repeat(2001) }).success,
    ).toBe(false);
  });
});
