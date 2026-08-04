import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it.each([
    [
      "listings",
      queryKeys.listings({ category: "books" }),
      ["listings", { category: "books" }],
    ],
    ["listing", queryKeys.listing("listing-1"), ["listing", "listing-1"]],
    [
      "listing reviews",
      queryKeys.listingReviews("listing-1"),
      ["listing", "listing-1", "reviews"],
    ],
    [
      "seller review rollup",
      queryKeys.sellerReviewRollup("seller-1"),
      ["seller", "seller-1", "reviews"],
    ],
    ["order", queryKeys.order("order-1"), ["orders", "order-1"]],
    [
      "delivered listing orders",
      queryKeys.deliveredOrdersForListing("listing-1"),
      ["orders", "delivered", "listing-1"],
    ],
    ["thread", queryKeys.thread("thread-1"), ["thread", "thread-1"]],
    [
      "wishlist membership",
      queryKeys.wishlistCheck("listing-1"),
      ["wishlist", "check", "listing-1"],
    ],
    [
      "auctions",
      queryKeys.auctions({ status: "active" }),
      ["auctions", { status: "active" }],
    ],
    [
      "escrow details",
      queryKeys.escrowDetails("order-1"),
      ["escrow", "order-1"],
    ],
    ["payout list", queryKeys.payouts(4), ["payouts", "list", 4]],
    ["return", queryKeys.return("return-1"), ["returns", "return-1"]],
  ])("builds the %s key", (_name, actual, expected) => {
    expect(actual).toEqual(expected);
  });

  it("uses a stable self scope for thread lists without a user id", () => {
    expect(queryKeys.threads()).toEqual(["threads", "self", 1]);
  });

  it("includes pagination and user scope in thread list keys", () => {
    expect(queryKeys.threads("user-42", 3)).toEqual(["threads", "user-42", 3]);
  });

  it("separates a listing fee preview by listing and subtotal", () => {
    expect(queryKeys.feePreview("listing-7", 2599)).toEqual([
      "fees",
      "preview",
      "listing-7",
      2599,
    ]);
  });
});
