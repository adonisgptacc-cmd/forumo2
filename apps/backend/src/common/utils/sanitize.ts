import sanitizeHtml from "sanitize-html";

/**
 * Strip all HTML tags and attributes from user-supplied rich text.
 * Use this for any field that is stored and later rendered (descriptions,
 * messages, review comments, etc.) to prevent stored-XSS.
 */
export function sanitizeText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
}

/**
 * Sanitize a record of string fields in place, returning a new object.
 * Only processes keys whose values are non-empty strings.
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  obj: T,
  keys: (keyof T)[],
): T {
  const result = { ...obj };
  for (const key of keys) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<keyof T, unknown>)[key] = sanitizeText(value);
    }
  }
  return result;
}
