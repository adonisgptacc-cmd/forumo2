import { describe, expect, it } from "vitest";

import { formatCurrency } from "./format-currency";

describe("formatCurrency", () => {
  it("formats USD amounts by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("supports an explicitly selected currency", () => {
    expect(formatCurrency(42, "EUR")).toBe("€42.00");
  });
});
