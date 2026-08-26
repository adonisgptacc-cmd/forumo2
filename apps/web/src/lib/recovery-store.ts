"use client";

// In-memory OAuth-account-recovery token store — survives client-side
// navigation but not page reload. Mirrors 2fa-store.ts's pattern: keeps
// the short-lived recovery token out of the URL (browser history, server
// access logs) the same way the 2FA token is kept out of it.
let token: string | null = null;
let email: string | null = null;

export function setRecoveryToken(t: string, e: string) {
  token = t;
  email = e;
}

export function getRecoveryToken(): string | null {
  return token;
}

export function getRecoveryEmail(): string | null {
  return email;
}

export function clearRecoveryToken() {
  token = null;
  email = null;
}
