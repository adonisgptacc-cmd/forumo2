# Auth Rewrite — Email/Phone Signup, Mandatory 2FA, Google OAuth Removal: Design

**Status:** Draft, pending Project Owner (ABADO) approval — protected workflow per `.assistant/rules/protected-paths.md` (Data migrations: this spec changes `User.email`/`User.phone` nullability/uniqueness and adds `OtpPurpose` enum values).

## Summary

The request describes this as "rewrite the authentication flow." It isn't a
rewrite — a substantial, mostly-correct auth system already exists:
bcrypt password hashing with complexity rules, **mandatory** TOTP 2FA with
backup codes, JWT access + refresh tokens with per-device sessions and
refresh-token-reuse detection, and Redis-backed distributed rate limiting.
This spec closes five specific, real gaps found by reading that system end
to end, rather than replacing it:

1. No phone-as-primary-identifier signup/login (`email` is required +
   unique in the schema; `phone` has no uniqueness constraint and isn't a
   login identifier).
2. SMS/email OTP exists but is wired only into password reset, not into
   the 2FA login step as a fallback for users without their authenticator.
3. No recovery path for existing Google-OAuth accounts (`passwordHash ===
   ""`) once Google login is removed.
4. Google OAuth itself, which needs full removal (backend + web).
5. The TOTP failed-attempt lockout is an in-process `Map` — silently
   ineffective across multiple backend replicas.

## Current state (verified by reading the code)

- `AuthService.login()` (`apps/backend/src/modules/auth/auth.service.ts`)
  never returns a session directly — it always returns either
  `{ twoFactorRequired: true }` (TOTP already enrolled) or
  `{ twoFactorSetupRequired: true }` (must enroll now). **2FA is already
  mandatory.**
- TOTP via `otplib` + `qrcode` (QR provisioning), 8 SHA-256-hashed
  one-time backup codes generated at enrollment (`verifySetup2FA`).
- Password: bcrypt (cost 10, `AuthService.saltRounds`), complexity
  enforced in `RegisterDto` (8–64 chars, upper/lower/digit/special char).
- Sessions: 15-minute access tokens, 30-day refresh tokens, per-device
  `DeviceSession` rows, refresh-token rotation with reuse detection (a
  replayed refresh token bumps `User.tokenVersion` and revokes every
  session for that user).
- Rate limiting: `ThrottlerModule` backed by Redis (`ThrottlerStorageRedis`
  in `apps/backend/src/modules/app.module.ts`), distinct configurable
  limits already exist for `auth-login` (default 5/15min), `auth-otp`,
  `auth-resend`, `auth-password-reset`.
- OTP delivery (`OtpDeliveryService`): SMS via AWS SNS, email via Mailgun,
  dev-mode simulator fallback when neither is configured. `OtpCode`
  records cap verification at 3 attempts and are consumed one-time.
  `OtpPurpose` enum currently has `LOGIN`, `PASSWORD_RESET`, `MFA` — `MFA`
  is defined but unused anywhere in the codebase today.
- `User.email` is `String @unique` (required). `User.phone` is `String?`
  with no uniqueness constraint and is not used as a login identifier.
  `RegisterDto.phone` is validated with `@IsPhoneNumber("ZA")` — hardcoded
  to South African numbers only.
- `OtpDeliveryService.resolveChannel()` (used for password-reset OTP
  today) picks `SMS` whenever `user.phone` is set, `EMAIL` otherwise —
  i.e. it currently prefers phone over email, the opposite of "email is
  primary when both exist."
- Google OAuth footprint:
  - Backend: `strategies/google.strategy.ts`, `guards/google-auth.guard.ts`
    (+ its spec), `AuthService.validateOrCreateGoogleUser()`, the
    `/auth/google`, `/auth/google/callback`, `/auth/oauth/exchange`
    endpoints in `auth.controller.ts`, `GoogleStrategy` registration in
    `auth.module.ts`. Dependency: `passport-google-oauth20` (+ `@types/`).
    Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
    `GOOGLE_CALLBACK_URL`.
  - Web: `components/google-signin-button.tsx`, used from
    `app/signup/signup-form.tsx` and `app/login/signin-form.tsx`; the
    `/auth/callback` page (`oauth-callback.tsx`) exchanges a short-lived
    httpOnly cookie for a bearer token via NextAuth's `token-auth`
    provider — that provider itself is generic (accepts any pre-issued
    JWT), not Google-specific, and is reused by the recovery flow below.
  - Mobile: no Google OAuth integration exists — no work needed there.
  - `validateOrCreateGoogleUser()` creates users with `passwordHash: ""`
    as a sentinel — already checked elsewhere (`changePassword` rejects
    with "not supported for accounts created via OAuth" when
    `!user.passwordHash`). This spec reuses that same sentinel to detect
    accounts needing recovery.

## Decisions made (this brainstorming session)

1. **No production Google-OAuth accounts exist today** — this is
   pre-launch. The recovery flow (design section 4) is still built
   properly rather than skipped, since it's cheap relative to the rest of
   this work and the account-state it handles (`passwordHash === ""`)
   will exist the moment anyone used the old flow, in any environment.
2. **Keep AWS SNS for SMS delivery**, not Twilio. `OtpDeliveryService`
   already has a working SNS integration; switching providers would add a
   new dependency and account for no functional gain here.
3. **Full parity for phone-only accounts** — every email-dependent flow
   (verification, password reset, 2FA fallback) gets a real SMS
   equivalent rather than degrading gracefully to "unavailable." No
   second-class accounts.
4. **Extend `User` in place** rather than introduce a separate
   multi-identifier table. Nothing in this request needs more than one
   email or one phone per user; a generalized identifiers table was
   considered and rejected as unnecessary complexity (YAGNI) that would
   touch every existing `user.email` read across the codebase for no
   near-term benefit.
5. **Reuse the existing `MFA` `OtpPurpose` value** for the 2FA OTP
   fallback (section 3) instead of adding a new enum value — it already
   exists, unused, for exactly this purpose.

## Design

### 1. Data model

`apps/backend/prisma/schema.prisma`, `User` model:

```prisma
email          String?         @unique   // was: String @unique
phone          String?         @unique   // was: String? (no uniqueness)
phoneVerified  Boolean         @default(false)  // new — mirrors emailVerified
```

`passwordHash` stays `String` (non-nullable) — the existing `""` sentinel
for "no real password yet" is preserved, not replaced, so the OAuth
recovery detection in section 4 keeps working unchanged.

**Downstream ripple, flagged not enumerated:** making `email` nullable
means every existing piece of code that treats `user.email` as an
always-present `string` (audit logs, `NotificationsService`, tax
receipts, admin listings) now has a `null` case to handle for
phone-only accounts. This spec establishes the principle (full parity —
decision 3) and fixes the two places structurally required for this
feature to work (verification, channel preference); a complete file-by-
file inventory of every `user.email` read site is implementation-plan
work, not spec work — call it out explicitly there so it isn't silently
missed.

`OtpPurpose` enum gains two values:

```prisma
enum OtpPurpose {
  LOGIN
  PASSWORD_RESET
  MFA
  PHONE_VERIFICATION   // new — phone-only signup verification
  ACCOUNT_RECOVERY      // new — OAuth-account password/2FA recovery (section 4)
}
```

"At least one of email or phone" is enforced in `AuthService.register()`
(application-level, matching this codebase's existing convention — Prisma
has no native `CHECK` constraint syntax and nothing else in this schema
uses raw-SQL constraints), not as a database constraint. A `NULL` on a
`@unique` column is not a conflict in Postgres (multiple `NULL`s are
allowed), so making both columns nullable-and-unique is safe with
existing seed/dev data that may have only one of the two set.

Migration: `ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL` +
`CREATE UNIQUE INDEX` on `phone` (Prisma generates both from the schema
diff). No backfill needed — existing rows already satisfy "at least one
of email/phone" since `email` was previously mandatory.

### 2. Signup / login with email or phone

`RegisterDto` (`apps/backend/src/modules/auth/dto/register.dto.ts`):
`email` becomes `@IsOptional() @IsEmail()`; `phone` becomes
`@IsOptional() @IsPhoneNumber()` (region argument dropped — was hardcoded
to `"ZA"`, now validates general E.164 format). A class-level custom
validator (`@Validate(AtLeastOneIdentifierConstraint)`) rejects requests
with neither field set, with a clear message.

`LoginDto`: `email: string` is replaced with `identifier: string`.
`AuthService.login()` gains a small classifier (does the string parse as
an email, per the same rule `class-validator`'s `IsEmail` uses — treat
anything else as a phone lookup) and looks the user up by `email` or
`phone` accordingly. One endpoint (`POST /auth/login`) continues to serve
both cases — no `/login/phone` split.

**Verification at signup:**
- Email present → unchanged: link-based verification email
  (`verifyEmail(token)`), as today.
- Phone-only signup → OTP-based verification instead of a link (there's
  no SMS equivalent of "click this link"): issue an `OtpCode` with
  purpose `PHONE_VERIFICATION`, delivered by SMS, confirmed through the
  existing `POST /auth/otp/verify` endpoint. The account is otherwise
  unusable (mirrors today's `emailVerified` gate in `login()`) until this
  completes — new `phoneVerified: Boolean @default(false)` field, gated
  the same way `emailVerified` is today.
- Email + phone both present → email verification is authoritative
  (matches "email is primary"); phone is stored but not independently
  gated.

**Uniqueness conflicts** on register (email or phone already taken)
return the same generic `ConflictException` used today for email — no
enumeration difference between which field collided.

**Channel preference fix:** `OtpDeliveryService.resolveChannel()` flips
from "prefer SMS if phone exists" to "prefer email if email exists,
else SMS" — a one-line change, but it's the concrete fix that makes
"email is primary when both exist" actually true for OTP delivery
(password reset today; the new 2FA fallback and phone verification in
this spec use it too).

### 3. 2FA OTP fallback ("I don't have my authenticator")

Two new endpoints in `AuthController`, both behind the existing
`TwoFactorPendingGuard` (mid-login only, after the primary credential is
verified) and both rejecting `req.twoFactorSetupRequired === true` —
TOTP enrollment stays mandatory as the first factor; this fallback only
applies to users who already completed it:

- `POST /auth/2fa/otp/request` — issues an `OtpCode` (purpose `MFA`) to
  the channel resolved from `req.twoFactorUserId` (the guard-verified
  pending user), **never** a client-supplied address — this closes off
  using the mid-login state to probe arbitrary emails/phones. Reuses
  `AuthService`'s existing `enforceDeviceRateLimit` /
  `enforceOtpCooldown` helpers and the `auth-otp` Redis throttle.
- `POST /auth/2fa/otp/verify` — verifies the code against `OtpCode`
  (purpose `MFA`, same `consumeOtp` logic already used elsewhere) instead
  of `authenticator.verify()`, then completes login through the same
  `buildAuthResponse` path `completeTwoFactorLogin` already uses
  (session creation, audit log, `lastLoginAt` update).

Once enrolled, a user has three ways to clear the 2FA gate: TOTP code,
a backup code (already implemented), or this OTP fallback. That's one
more option than strictly necessary given backup codes already solve
"lost my authenticator," but it's what was asked for and it's a
materially better UX than digging up a saved backup code.

### 4. Removing Google OAuth + recovery for existing OAuth accounts

**Removal (backend):** delete `strategies/google.strategy.ts`,
`guards/google-auth.guard.ts` (+ its spec),
`AuthService.validateOrCreateGoogleUser()`, the `/auth/google`,
`/auth/google/callback`, `/auth/oauth/exchange` endpoints, and the
`GoogleStrategy` provider registration in `auth.module.ts`. Remove the
`passport-google-oauth20` and `@types/passport-google-oauth20`
dependencies from `apps/backend/package.json`, and `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` from `.env.example` and
`config.schema.ts` if referenced there.

**Removal (web):** delete `components/google-signin-button.tsx` and its
two call sites (`signup-form.tsx`, `signin-form.tsx`); delete the
now-unreachable `/auth/callback` route (`oauth-callback.tsx`) — nothing
will link to it once the Google button is gone. The `token-auth` NextAuth
provider stays; it's generic and reused below.

**Recovery for existing OAuth accounts** (`passwordHash === ""`):

1. `AuthService.login()` gains one new branch, checked before the
   password comparison: if the resolved user has `passwordHash === ""`,
   skip the normal 2FA gate and return
   `{ passwordSetupRequired: true, recoveryToken }` — a 5-minute JWT,
   same construction as `issueTwoFactorToken`.
2. `POST /auth/recover-oauth-account/request` (public) — takes `email`,
   returns a generic response regardless of whether the account exists
   (matches the enumeration-avoidance pattern already used by
   `resendVerification`). If the account exists and has
   `passwordHash === ""`, sends an `OtpCode` (purpose
   `ACCOUNT_RECOVERY`) to that email — the same address Google already
   verified — proving inbox ownership.
3. `POST /auth/recover-oauth-account/confirm` — takes `email`, `code`,
   `newPassword`, optional `phone`. Verifies the OTP via the existing
   `consumeOtp` logic, sets `passwordHash` (bcrypt), optionally sets
   `phone`, and bumps `tokenVersion` (invalidates any stale session
   state). Returns the same `{ twoFactorSetupRequired: true }` response
   the normal registration path produces — the user lands directly in
   the existing mandatory TOTP enrollment flow, no special-casing
   downstream.
4. Web: the login page detects `passwordSetupRequired` in the
   `/auth/login` response and routes into a small new form that calls
   the two endpoints above, then continues into the existing (unchanged)
   2FA-setup screen.

**Accepted tradeoff:** returning `passwordSetupRequired: true` for a
known OAuth account is a small enumeration signal (confirms "this email
exists and was created via Google"). This codebase is otherwise careful
about enumeration; the exception is deliberate — a locked-out real user
needs to know *why*, and this design is choosing that over a marginally
tighter API surface.

### 5. Security hardening

**TOTP lockout → Redis.** `AuthService`'s `totpAttempts` (an in-process
`Map<userId, {count, lockedUntil}>`) resets independently per backend
replica, silently giving an attacker up to 5 free guesses per instance in
any multi-replica deployment. Replace it with TTL-keyed Redis counters
(same `ioredis` client already used by `ThrottlerStorageRedis`), same
5-attempts / 15-minute-lock semantics, now correct across replicas.

**Everything else reviewed and found already sufficient, no changes:**
OTP brute-force (3-attempt cap per code, already enforced in
`consumeOtp`), OTP expiry (`OTP_TTL`, default 300s, already
configurable), backup codes (already hashed at rest, one-time use),
login rate limiting (already Redis-backed and distributed-safe),
refresh-token reuse detection (already revokes all sessions on replay).

## New environment variables / dependencies / third-party services

**None required.** Every piece this design needs — `bcrypt`, `otplib`,
`qrcode`, `@aws-sdk/client-sns`, Mailgun via `fetch`, Redis-backed
throttling — is already installed and configured. Net dependency change
is **negative two** (`passport-google-oauth20` + its `@types` package,
removed).

The only operational note: `SNS_REGION` / `SNS_ACCESS_KEY_ID` /
`SNS_SECRET_ACCESS_KEY` (already-defined, currently-optional env vars)
become functionally necessary in any environment where phone signup or
the SMS 2FA fallback needs to actually deliver — today, without them,
`OtpDeliveryService` silently falls back to its dev simulator. No new
variable names are introduced.

## Testing

- `AtLeastOneIdentifierConstraint`: rejects email-less, phone-less
  requests with neither set; accepts either alone or both.
- Register: phone-only signup creates an unverified account, blocked
  from login until `PHONE_VERIFICATION` OTP is consumed (mirrors the
  existing `emailVerified` gate test pattern).
- Login: identifier classifier correctly routes email-shaped strings to
  email lookup, everything else to phone lookup; ambiguous/malformed
  input is rejected before hitting either lookup.
- `resolveChannel()`: prefers email when both email and phone are
  present (this is the regression test for the primary-identifier
  channel-preference fix — must fail against the current code before the
  fix, since today it prefers SMS).
- 2FA OTP fallback: `2fa/otp/request` rejects when
  `twoFactorSetupRequired` is true; `2fa/otp/verify` completes login
  correctly and is independent of/does not consume TOTP attempt state.
- OAuth recovery: `login()` returns `passwordSetupRequired` only for
  `passwordHash === ""` accounts; `recover-oauth-account/confirm` sets a
  working password, bumps `tokenVersion`, and its response routes
  correctly into the existing mandatory-2FA-setup flow.
- TOTP lockout: concurrent failure counters correctly shared across two
  simulated "replicas" (two `AuthService` instances backed by the same
  Redis) — this is the regression test proving the in-memory `Map`
  bug is fixed.
- Google OAuth removal: `/auth/google`, `/auth/google/callback`,
  `/auth/oauth/exchange` return 404 (route no longer exists); no
  remaining reference to `passport-google-oauth20` anywhere in
  `apps/backend/src` (grep-based check in CI is out of scope for this
  spec — a manual check is sufficient here).

## Explicitly out of scope

- Any mobile-app auth changes — `apps/mobile` has no Google OAuth
  integration and isn't part of this request.
- A generalized multi-identifier data model (see decision 4) — rejected
  as unneeded for what's actually being asked.
- Passwordless/magic-link login — not requested; the existing
  password-based flow is kept, just extended to accept phone as an
  identifier.
- Changing the JWT/session/refresh-token design itself — already correct
  per this spec's own review; no changes proposed.
- A CI check enforcing "no Google OAuth references remain" — manual
  verification is sufficient for a one-time removal.

## Approval

Per `.assistant/rules/protected-paths.md`, this spec requires explicit,
scoped approval from the Project Owner before any implementation begins
— it changes the Prisma schema (`User.email`/`User.phone`
nullability/uniqueness, new `OtpPurpose` values) and removes a live auth
provider (Google OAuth) end to end. Approval is scoped to this spec's
content — a later change to auth behavior needs its own approval.
