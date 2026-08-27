import { normalizePhoneNumber } from "./phone.util";

describe("normalizePhoneNumber", () => {
  it("converts a South African national-format number to E.164", () => {
    expect(normalizePhoneNumber("0821234567")).toBe("+27821234567");
  });

  it("converts a spaced/punctuated international number to canonical E.164", () => {
    expect(normalizePhoneNumber("+27 82 123 4567")).toBe("+27821234567");
  });

  it("leaves an already-canonical E.164 number unchanged", () => {
    expect(normalizePhoneNumber("+27821234567")).toBe("+27821234567");
  });

  it("normalizes two differently-formatted representations of the same number identically", () => {
    expect(normalizePhoneNumber("0821234567")).toBe(
      normalizePhoneNumber("+27 82 123 4567"),
    );
  });

  it("normalizes a non-default-region international number using its own country code", () => {
    expect(normalizePhoneNumber("+1 415 555 2671")).toBe("+14155552671");
  });

  it("returns the trimmed input unchanged when it cannot be parsed as a valid phone number", () => {
    expect(normalizePhoneNumber("not-a-phone")).toBe("not-a-phone");
  });

  it("trims surrounding whitespace even when normalization does not apply", () => {
    expect(normalizePhoneNumber("  not-a-phone  ")).toBe("not-a-phone");
  });
});
