"use client";

// In-memory 2FA token store — survives client-side navigation but not page reload.
// This replaces sessionStorage per H10 (no XSS-persisted JWT/2FA token).
let token: string | null = null;
let callbackUrl: string = "/app";

export function set2FaToken(t: string, cb: string) {
  token = t;
  callbackUrl = cb;
}

export function get2FaToken(): string | null {
  return token;
}

export function get2FaCallbackUrl(): string {
  return callbackUrl;
}

export function clear2FaToken() {
  token = null;
  callbackUrl = "/app";
}
