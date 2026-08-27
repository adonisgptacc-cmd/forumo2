import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

/**
 * `User.phone` is `@unique`, so lookups and writes must agree on a single
 * canonical representation — otherwise "+27821234567" and "0821234567" (the
 * same number) are treated as distinct, letting a user register twice or
 * fail to log in with a differently-formatted version of their own number.
 * National-format numbers (e.g. a South African user typing "0821234567")
 * are parsed against this default region since Forumo's userbase is
 * primarily South African.
 */
export const DEFAULT_PHONE_REGION: CountryCode = "ZA";

/**
 * Normalizes a phone number to E.164. Falls back to the trimmed input
 * unchanged if it can't be parsed as a valid number — callers that need to
 * reject invalid input (e.g. DTO validation) still see it fail their own
 * checks, and callers doing a lookup (e.g. login) get a harmless no-match
 * instead of an error, avoiding an information leak about input shape.
 */
export function normalizePhoneNumber(
  value: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_REGION,
): string {
  const trimmed = value.trim();
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  return parsed?.isValid() ? parsed.format("E.164") : trimmed;
}
