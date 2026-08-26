# Auth Rewrite (Email/Phone, Mandatory 2FA, Google OAuth Removal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user sign up and log in with email OR phone (email primary when both exist), add an SMS/email OTP fallback to the already-mandatory TOTP 2FA gate, remove Google OAuth end to end, and give existing Google-OAuth accounts a way to set a password and enroll in 2FA instead of being locked out.

**Architecture:** Extends the existing `User` model and `AuthService`/`AuthController` in place — no new modules. `email` becomes nullable+unique, `phone` becomes unique, two new `OtpPurpose` values are added. All new flows reuse existing infrastructure (bcrypt, `otplib`, the `OtpCode` table, `OtpDeliveryService`, `CacheService`/Redis, the Redis-backed `ThrottlerModule`) — nothing new is installed.

**Tech Stack:** NestJS 10, Prisma 5, `class-validator` (auth module's existing DTO style — not `nestjs-zod`, which is used elsewhere in the backend but not in this module today), `bcrypt`, `otplib`, `@aws-sdk/client-sns`, Next.js 15 / NextAuth v4 (web).

**Spec:** `docs/superpowers/specs/2026-08-25-auth-rewrite-design.md`

## Global Constraints

- No new npm dependencies (backend or web) — the spec's own design decision. `passport-google-oauth20` and `@types/passport-google-oauth20` are removed, not replaced.
- No new environment variable *names* — `SNS_REGION`/`SNS_ACCESS_KEY_ID`/`SNS_SECRET_ACCESS_KEY` already exist and become functionally necessary for real SMS delivery, but nothing new is defined.
- TOTP stays the mandatory *primary* 2FA method; SMS/email OTP is a fallback only, available after TOTP is already enrolled (never during setup).
- Email is the primary identifier when both email and phone exist — applies to login lookup, verification, and OTP delivery channel choice.
- This is a protected-path task per `.assistant/rules/protected-paths.md` (Data migrations: Prisma schema changes; also touches a live auth provider). Do not run `prisma migrate deploy` against a real database, and do not push/merge this work, without the Project Owner's explicit scoped approval first.
- Follow this repo's TDD convention throughout: write the failing test, watch it fail, implement, watch it pass, commit.

---

### Task 1: Prisma schema migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260825000000_auth_email_phone_identifiers/migration.sql`

**Interfaces:**
- Produces: `User.email` becomes `String?` (was `String`, still `@unique`); `User.phone` becomes `String? @unique` (was `String?`, unconstrained); new `User.phoneVerified Boolean @default(false)`; `OtpPurpose` enum gains `PHONE_VERIFICATION` and `ACCOUNT_RECOVERY`. Every later task in this plan depends on these.

- [ ] **Step 1: Edit the Prisma schema**

In `apps/backend/prisma/schema.prisma`, find the `User` model (`model User {`) and change:

```prisma
  email          String          @unique
```
to:
```prisma
  email          String?         @unique
```

and change:
```prisma
  phone          String?
```
to:
```prisma
  phone          String?         @unique
```

Add a new field right after `phone`:
```prisma
  phoneVerified  Boolean         @default(false)
```

Find `enum OtpPurpose {` and change:
```prisma
enum OtpPurpose {
  LOGIN
  PASSWORD_RESET
  MFA
}
```
to:
```prisma
enum OtpPurpose {
  LOGIN
  PASSWORD_RESET
  MFA
  PHONE_VERIFICATION
  ACCOUNT_RECOVERY
}
```

- [ ] **Step 2: Generate the Prisma client**

Run (from `apps/backend`):
```bash
npx prisma generate --schema prisma/schema.prisma
```
Expected: `✔ Generated Prisma Client` with no errors. This works even without a live database — it only reads the schema file.

- [ ] **Step 3: Write the migration SQL**

Create `apps/backend/prisma/migrations/20260825000000_auth_email_phone_identifiers/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'PHONE_VERIFICATION';
ALTER TYPE "OtpPurpose" ADD VALUE 'ACCOUNT_RECOVERY';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
```

No backfill statement is needed: every existing row already has a non-null `email` (it was required until this migration), so "at least one of email/phone" is trivially satisfied for all existing data.

- [ ] **Step 4: Apply the migration if a database is available**

If PostgreSQL is running locally (`pnpm docker:up` from repo root, then check with `docker compose ps`), run:
```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```
Expected: `1 migration found... Database schema is up to date` or similar success output, no errors. **Do not run this against any shared/staging/production database** — this task only covers local/dev application, per the Global Constraints above.

If no database is available in this environment, skip this step — Step 2's `prisma generate` already produced a client whose types match the new schema, which is what every later task compiles against.

- [ ] **Step 5: Run the existing test suite to confirm nothing broke**

Run (from `apps/backend`):
```bash
npx jest
```
Expected: same pass count as before this change (types changed, but no behavior changed yet — `email`/`phone` are still always populated by every existing code path). If any test fails to compile because it constructs a `User` object literal missing a field, that's expected only if the literal predates `phoneVerified` — add `phoneVerified: false` to any such fixture (e.g. `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts`'s `UserRecord` type/seed data, `apps/backend/src/modules/auth/__tests__/auth.service.spec.ts`'s `createUser()`).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/20260825000000_auth_email_phone_identifiers
git commit -m "feat(auth): add phone/email identifier schema support"
```

---

### Task 2: Shared package — types and API client for identifier-based auth

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/api-client.ts`
- Test: `packages/shared/src/api-client.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure type/schema layer).
- Produces: `identifierLoginPayloadSchema`/`IdentifierLoginPayload` (replaces `loginPayloadSchema`/`LoginPayload`'s `email` field with `identifier`), `passwordSetupRequiredSchema`/`PasswordSetupRequired`, `registerPayloadSchema` with optional `email`, `safeUserSchema`/`authResponseSchema` with nullable `email`. `ForumoApiClient.auth.login()` now takes `{ identifier, password, ... }` and its return type includes `PasswordSetupRequired`. `ForumoApiClient.auth.recoverOAuthAccount.request(email)` / `.confirm({...})`. `ForumoApiClient.auth.request2FAOtp(twoFactorToken)` / `.verify2FAOtp(twoFactorToken, code, opts)`. Backend tasks 5–9 implement the endpoints these call.

- [ ] **Step 1: Write the failing tests**

Add to `packages/shared/src/api-client.test.ts` (near the existing `describe("getApiBaseUrl", ...)` blocks, as a new top-level `describe`):

```ts
import {
  passwordSetupRequiredSchema,
  identifierLoginPayloadSchema,
  registerPayloadSchema,
  safeUserSchema,
} from "./types";

describe("passwordSetupRequiredSchema", () => {
  it("parses the password-setup-required login response", () => {
    const parsed = passwordSetupRequiredSchema.parse({
      passwordSetupRequired: true,
      recoveryToken: "a.b.c",
    });
    expect(parsed.passwordSetupRequired).toBe(true);
  });
});

describe("identifierLoginPayloadSchema", () => {
  it("accepts an email-shaped identifier", () => {
    expect(() =>
      identifierLoginPayloadSchema.parse({
        identifier: "zuri@example.com",
        password: "hunter2!Aa",
      }),
    ).not.toThrow();
  });

  it("accepts a phone-shaped identifier", () => {
    expect(() =>
      identifierLoginPayloadSchema.parse({
        identifier: "+27821234567",
        password: "hunter2!Aa",
      }),
    ).not.toThrow();
  });
});

describe("registerPayloadSchema", () => {
  it("allows a phone-only registration with no email", () => {
    expect(() =>
      registerPayloadSchema.parse({
        name: "Zuri",
        password: "hunter2!Aa",
        phone: "+27821234567",
      }),
    ).not.toThrow();
  });
});

describe("safeUserSchema", () => {
  it("allows a null email for phone-only accounts", () => {
    expect(() =>
      safeUserSchema.parse({
        id: "user-1",
        email: null,
        phone: "+27821234567",
        role: "BUYER",
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `packages/shared`):
```bash
npx vitest run api-client.test.ts
```
Expected: FAIL — `passwordSetupRequiredSchema`/`identifierLoginPayloadSchema` don't exist yet (import error), and `registerPayloadSchema`/`safeUserSchema` reject the phone-only/null-email cases.

- [ ] **Step 3: Update the schemas**

In `packages/shared/src/types.ts`, change `safeUserSchema` (around line 22–34):

```ts
export const safeUserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional(),
  name: z.string().nullable().optional(),
  role: userRoleSchema,
  avatarUrl: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  trustScore: z.number().int().optional(),
  tosVersion: z.string().nullable().optional(),
  termsAcceptedAt: z.union([z.string(), z.date()]).nullable().optional(),
  deletionScheduledAt: z.union([z.string(), z.date()]).nullable().optional(),
});
```

Change `loginPayloadSchema` (around line 479–483) — rename `email` to `identifier`:

```ts
export const identifierLoginPayloadSchema = z.object({
  identifier: z.string().min(1),
  password: z.string(),
});
export type IdentifierLoginPayload = z.infer<
  typeof identifierLoginPayloadSchema
>;
```

Change `registerPayloadSchema` (around line 485–491) — `email` optional:

```ts
export const registerPayloadSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  password: z.string().min(8),
  phone: z.string().optional(),
});
export type RegisterPayload = z.infer<typeof registerPayloadSchema>;
```

Add a new schema right after `twoFactorSetupRequiredSchema` (around line 510):

```ts
export const passwordSetupRequiredSchema = z.object({
  passwordSetupRequired: z.literal(true),
  recoveryToken: z.string(),
});
export type PasswordSetupRequired = z.infer<
  typeof passwordSetupRequiredSchema
>;
```

Change `authResponseSchema`'s nested `user.email` (around line 517) the same way as `safeUserSchema`:

```ts
    email: z.string().email().nullable().optional(),
```

- [ ] **Step 4: Update the API client**

In `packages/shared/src/api-client.ts`, update the imports at the top to include the new schema/type names (`passwordSetupRequiredSchema`, `PasswordSetupRequired`, `identifierLoginPayloadSchema`, `registerPayloadSchema` was already imported — check it still is).

Replace the `login` method (around line 294–310):

```ts
    login: async (payload: {
      identifier: string;
      password: string;
      deviceFingerprint?: string;
    }): Promise<
      | AuthResponse
      | TwoFactorRequired
      | TwoFactorSetupRequired
      | PasswordSetupRequired
    > => {
      const response = await this.requestJson<
        | AuthResponse
        | TwoFactorRequired
        | TwoFactorSetupRequired
        | PasswordSetupRequired
      >("/auth/login", {
        method: "POST",
        body: payload,
      });
      if (twoFactorRequiredSchema.safeParse(response).success)
        return twoFactorRequiredSchema.parse(response);
      if (twoFactorSetupRequiredSchema.safeParse(response).success)
        return twoFactorSetupRequiredSchema.parse(response);
      if (passwordSetupRequiredSchema.safeParse(response).success)
        return passwordSetupRequiredSchema.parse(response);
      return authResponseSchema.parse(response);
    },
```

Replace the `register` method's payload type (around line 362–372) — `email` optional:

```ts
    register: async (payload: {
      name: string;
      email?: string;
      password: string;
      phone?: string;
    }): Promise<{ message: string }> => {
      return this.requestJson<{ message: string }>("/auth/register", {
        method: "POST",
        body: payload,
      });
    },
```

Add three new methods inside the `auth` namespace object, after `verify2FA` (around line 351):

```ts
    request2FAOtp: async (
      twoFactorToken: string,
    ): Promise<{ message: string; channel: string; deliveredAt: string }> => {
      return this.requestJson("/auth/2fa/otp/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${twoFactorToken}` },
      });
    },
    verify2FAOtp: async (
      twoFactorToken: string,
      code: string,
      opts?: { rememberMe?: boolean; deviceFingerprint?: string },
    ): Promise<AuthResponse> => {
      return this.requestJson("/auth/2fa/otp/verify", {
        method: "POST",
        body: { code, ...opts },
        headers: { Authorization: `Bearer ${twoFactorToken}` },
      });
    },
```

Add a new `recoverOAuthAccount` namespace, after the `auth` object's `disable2FA` method (or anywhere inside the `auth` object — it groups logically with account recovery):

```ts
    recoverOAuthAccount: {
      request: async (email: string): Promise<{ message: string }> => {
        return this.requestJson<{ message: string }>(
          "/auth/recover-oauth-account/request",
          { method: "POST", body: { email } },
        );
      },
      confirm: async (payload: {
        email: string;
        code: string;
        newPassword: string;
        phone?: string;
      }): Promise<TwoFactorSetupRequired> => {
        const response = await this.requestJson<TwoFactorSetupRequired>(
          "/auth/recover-oauth-account/confirm",
          { method: "POST", body: payload },
        );
        return twoFactorSetupRequiredSchema.parse(response);
      },
    },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `packages/shared`):
```bash
npx vitest run api-client.test.ts
```
Expected: PASS, all tests including the four new ones.

- [ ] **Step 6: Rebuild the package**

Run (from `packages/shared`):
```bash
npx tsc -p tsconfig.json
```
Expected: no errors. This keeps `dist/` in sync for consumers (`apps/backend`, `apps/web`, `apps/admin`) that import the built output.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/api-client.ts packages/shared/src/api-client.test.ts
git commit -m "feat(shared): identifier-based login, phone-optional register, password-setup-required schema"
```

---

### Task 3: Fix OTP channel preference to be email-primary

**Files:**
- Modify: `apps/backend/src/modules/auth/otp-delivery.service.ts:60-64`
- Modify: `apps/backend/src/modules/auth/auth.service.ts:884-893` (`resolveChannel`)
- Create: `apps/backend/src/modules/auth/otp-delivery.service.spec.ts`

**Interfaces:**
- Produces: both channel-resolution functions now prefer `EMAIL` when a user has both an email and a phone, matching each other (this matters — `deliver()` picks the channel an OTP is *sent* on, `resolveChannel()` picks which channel's OTP record `verifyOtp()`/`confirmPasswordReset()` look up; they must agree or verification breaks for every dual-identifier user).

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/auth/otp-delivery.service.spec.ts`:

```ts
import { ConfigService } from "@nestjs/config";
import { NotificationChannel, User } from "@prisma/client";

import { OtpDeliveryService } from "./otp-delivery.service";
import { RequestOtpDto } from "./dto/request-otp.dto";

const configService = {
  get: () => undefined,
  getOrThrow: () => {
    throw new Error("not configured in this test");
  },
} as unknown as ConfigService;

const dtoWithoutChannel: RequestOtpDto = {
  email: "zuri@example.com",
  purpose: "PASSWORD_RESET" as RequestOtpDto["purpose"],
  deviceFingerprint: "fp-1",
};

const userWithBoth = {
  email: "zuri@example.com",
  phone: "+27821234567",
} as User;

const userPhoneOnly = {
  email: null,
  phone: "+27821234567",
} as unknown as User;

describe("OtpDeliveryService.deliver channel preference", () => {
  let service: OtpDeliveryService;

  beforeEach(() => {
    service = new OtpDeliveryService(configService);
  });

  it("prefers EMAIL when the user has both an email and a phone", async () => {
    const result = await service.deliver(userWithBoth, dtoWithoutChannel, "123456");
    expect(result.channel).toBe(NotificationChannel.EMAIL);
  });

  it("falls back to SMS when the user has no email", async () => {
    const result = await service.deliver(userPhoneOnly, dtoWithoutChannel, "123456");
    expect(result.channel).toBe(NotificationChannel.SMS);
  });

  it("respects an explicit channel override even when email is present", async () => {
    const result = await service.deliver(
      userWithBoth,
      { ...dtoWithoutChannel, channel: NotificationChannel.SMS },
      "123456",
    );
    expect(result.channel).toBe(NotificationChannel.SMS);
  });

  it("throws rather than emailing a phone-only user forced onto the EMAIL channel", async () => {
    await expect(
      service.deliver(
        userPhoneOnly,
        { ...dtoWithoutChannel, channel: NotificationChannel.EMAIL },
        "123456",
      ),
    ).rejects.toThrow(/no email address/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/backend`):
```bash
npx jest otp-delivery.service.spec.ts
```
Expected: FAIL on two tests — `deliver()` currently returns `SMS` for `userWithBoth` (it prefers phone today), and the null-email guard test fails because `deliver()` doesn't check for a missing email yet (it would currently call `sendEmail(null, code)`, which either throws a different, unasserted error or misbehaves depending on the mocked delivery path — either way, not the specific message this test expects).

- [ ] **Step 3: Fix `OtpDeliveryService.deliver()`**

In `apps/backend/src/modules/auth/otp-delivery.service.ts`, change lines 60–64:

```ts
    const explicitChannel = dto.channel;
    const inferredChannel = user.email
      ? NotificationChannel.EMAIL
      : NotificationChannel.SMS;
    const channel = explicitChannel ?? inferredChannel;
```

`User.email` is now nullable (Task 1), so the method's final branch — `return this.sendEmail(user.email, code);`, reached when `channel === NotificationChannel.SMS && user.phone` is false, i.e. the EMAIL path — no longer type-checks (`sendEmail`'s parameter is `string`). Find that line and guard it:

```ts
    if (channel === NotificationChannel.SMS && user.phone) {
      return this.sendSms(user.phone, code);
    }

    if (!user.email) {
      // Unreachable in practice: the preference above only resolves to
      // EMAIL when user.email is set (falls back to SMS otherwise), and an
      // explicit channel override of EMAIL for a phone-only user is a
      // caller error this method has no other identifier to satisfy.
      throw new BadRequestException(
        "Cannot deliver an email OTP: this account has no email address",
      );
    }
    return this.sendEmail(user.email, code);
```

This requires adding `BadRequestException` to the `@nestjs/common` import at the top of `otp-delivery.service.ts` (currently only imports `Injectable`, `Logger`).

- [ ] **Step 4: Fix `AuthService.resolveChannel()`**

In `apps/backend/src/modules/auth/auth.service.ts`, change lines 884–893:

```ts
  private resolveChannel(
    requestedChannel: NotificationChannel | undefined,
    user: User,
  ): NotificationChannel {
    if (requestedChannel) {
      return requestedChannel;
    }

    return user.email ? NotificationChannel.EMAIL : NotificationChannel.SMS;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `apps/backend`):
```bash
npx jest otp-delivery.service.spec.ts
```
Expected: PASS, all four tests.

Then fix the one existing test that encodes the old (buggy) behavior:
`apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts:374`, `it("prefers SMS when the user has a phone and channel is omitted", ...)`. That test seeds a user with both email and phone (`createUser(prisma, { phone: "+233550000001" })` — `createUser`'s default already includes `email: "otp@example.com"`) and asserts `NotificationChannel.SMS`. Rename and flip it:

```ts
  it("prefers EMAIL when the user has both identifiers and channel is omitted", async () => {
    const user = await createUser(prisma, { phone: "+233550000001" });
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
      .spyOn<any, string>(authService as any, "generateOtpCode")
      .mockReturnValue("999000");

    const response = await request(app.getHttpServer())
      .post("/auth/otp/request")
      .send({
        email: user.email,
        purpose: OtpPurpose.LOGIN,
        deviceFingerprint: "device-sms",
      })
      .expect(201);

    expect(response.body.channel).toBe(NotificationChannel.EMAIL);
    const [, deliveredDto] = otpDelivery.deliver.mock.calls[0];
    expect((deliveredDto as RequestOtpDto).channel).toBeUndefined();
    expect(prisma.otpCodes[0].channel).toBe(NotificationChannel.EMAIL);
  });
```

This still sends `email: user.email` — the DTO field itself is still called `email` until Task 6 renames it to `identifier`. Task 6's step list below revisits this exact test (along with every other `.send({ email: ... })` call site in this file) to complete that rename; don't jump ahead of it here.

Then run the full auth suite:
```bash
npx jest auth
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/auth/otp-delivery.service.ts apps/backend/src/modules/auth/auth.service.ts apps/backend/src/modules/auth/otp-delivery.service.spec.ts
git commit -m "fix(auth): prefer email over SMS for OTP delivery when both identifiers exist"
```

---

### Task 4: `AtLeastOneIdentifier` validator + `RegisterDto`/`LoginDto`

**Files:**
- Create: `apps/backend/src/modules/auth/validators/at-least-one-identifier.validator.ts`
- Create: `apps/backend/src/modules/auth/validators/at-least-one-identifier.validator.spec.ts`
- Modify: `apps/backend/src/modules/auth/dto/register.dto.ts`
- Modify: `apps/backend/src/modules/auth/dto/login.dto.ts`

**Interfaces:**
- Produces: `RegisterDto` with `email?: string`, `phone?: string` (general E.164, not `"ZA"`-locked), validated by the new `@Validate(AtLeastOneIdentifierConstraint)`. `LoginDto` with `identifier: string` replacing `email: string`. Task 5 consumes both.

- [ ] **Step 1: Write the failing test for the validator**

Create `apps/backend/src/modules/auth/validators/at-least-one-identifier.validator.spec.ts`:

```ts
import { validate } from "class-validator";

import { RegisterDto } from "../dto/register.dto";

describe("AtLeastOneIdentifierConstraint (via RegisterDto)", () => {
  const base = { name: "Zuri", password: "hunter2!Aa" };

  it("rejects a registration with neither email nor phone", async () => {
    const dto = Object.assign(new RegisterDto(), base);
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.atLeastOneIdentifier)).toBe(
      true,
    );
  });

  it("accepts email only", async () => {
    const dto = Object.assign(new RegisterDto(), {
      ...base,
      email: "zuri@example.com",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.atLeastOneIdentifier)).toBe(
      false,
    );
  });

  it("accepts phone only", async () => {
    const dto = Object.assign(new RegisterDto(), {
      ...base,
      phone: "+27821234567",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.atLeastOneIdentifier)).toBe(
      false,
    );
  });

  it("accepts both", async () => {
    const dto = Object.assign(new RegisterDto(), {
      ...base,
      email: "zuri@example.com",
      phone: "+27821234567",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.atLeastOneIdentifier)).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/backend`):
```bash
npx jest at-least-one-identifier.validator.spec.ts
```
Expected: FAIL — `RegisterDto` doesn't have this validator wired up yet (all four assertions fail, since `errors.some(...)` is always `false` today regardless of input).

- [ ] **Step 3: Write the validator**

Create `apps/backend/src/modules/auth/validators/at-least-one-identifier.validator.ts`:

```ts
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "atLeastOneIdentifier", async: false })
export class AtLeastOneIdentifierConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { email?: string; phone?: string };
    return Boolean(obj.email?.trim() || obj.phone?.trim());
  }

  defaultMessage(): string {
    return "Provide an email or a phone number";
  }
}

export function AtLeastOneIdentifier(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "atLeastOneIdentifier",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: AtLeastOneIdentifierConstraint,
    });
  };
}
```

- [ ] **Step 4: Wire it into `RegisterDto` and drop the `"ZA"` phone restriction**

Replace `apps/backend/src/modules/auth/dto/register.dto.ts` entirely:

```ts
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import { AtLeastOneIdentifier } from "../validators/at-least-one-identifier.validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  @AtLeastOneIdentifier()
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      "password must include upper and lower case letters, a number and a special character",
  })
  password!: string;

  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: "phone must be a valid international number (e.g. +27821234567)",
  })
  phone?: string;
}
```

`@AtLeastOneIdentifier()` is placed on `email` (not `phone`) so the constraint runs exactly once per validation pass — `class-validator` runs every decorator on every property, and putting it on both fields would just produce the same error twice.

- [ ] **Step 5: Update `LoginDto`**

Replace `apps/backend/src/modules/auth/dto/login.dto.ts`'s `email` field:

```ts
import {
  IsBoolean,
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class LoginDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @IsOptional()
  @IsString()
  @Length(8, 256)
  deviceFingerprint?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsIP(undefined, {
    message: "ipAddress must be a valid IPv4 or IPv6 address",
  })
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
```

(`IsEmail` is no longer imported since `identifier` can be either shape — classification happens in `AuthService`, Task 5.)

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `apps/backend`):
```bash
npx jest at-least-one-identifier.validator.spec.ts
```
Expected: PASS, all four tests.

Run the full backend test suite to see what else references `LoginDto.email` or `RegisterDto`'s old shape — expect compile errors in `auth.controller.ts` (still calls `authService.login(dto)` with the old shape, fixed in Task 5) and any test file constructing `{ email: ... }` for login. Do not fix those yet — Task 5 does. Confirm the failures are exactly "identifier-shape mismatch" compile errors, nothing else:
```bash
npx tsc --noEmit
```
Expected: errors only in files that reference `LoginDto`'s `email` field or `AuthService.login`'s `dto.email` — a short, explainable list. If anything else fails to compile, stop and investigate before continuing.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/auth/validators apps/backend/src/modules/auth/dto/register.dto.ts apps/backend/src/modules/auth/dto/login.dto.ts
git commit -m "feat(auth): validate at-least-one-identifier and accept identifier-based login"
```

(This commit leaves the backend not compiling — expected and resolved by Task 5, which is the very next task. If subagent-driven-development reviews between tasks, note this dependency explicitly so a task-scoped reviewer doesn't flag it as broken.)

---

### Task 5: `AuthService` identifier-based lookup for register/login

**Files:**
- Modify: `apps/backend/src/modules/auth/auth.service.ts`
- Test: `apps/backend/src/modules/auth/__tests__/auth.service.spec.ts`

**Interfaces:**
- Consumes: `RegisterDto`/`LoginDto` from Task 4.
- Produces: `AuthService.findActiveUserByPhone(phone)`, `AuthService.classifyIdentifier(identifier): "email" | "phone"`, `AuthService.findActiveUserByIdentifier(identifier)`. `register()` accepts email-only, phone-only, or both. `login()` looks up by whichever the identifier resolves to. Task 6 reuses `findActiveUserByIdentifier` and `classifyIdentifier`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/backend/src/modules/auth/__tests__/auth.service.spec.ts` (in the existing `describe` block, alongside other `register`/`login` tests — match the file's existing mock-`prisma` style):

```ts
describe("phone-primary register/login", () => {
  it("registers a phone-only user without requiring an email", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      ...createUser(),
      id: "user-2",
      email: null,
      phone: "+27821234567",
      emailVerified: false,
      phoneVerified: false,
    });

    const result = await service.register({
      name: "Thabo",
      password: "hunter2!Aa",
      phone: "+27821234567",
    } as never);

    expect(result.message).toMatch(/phone/i);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: "+27821234567" }),
      }),
    );
  });

  it("logs in by phone when the identifier is not email-shaped", async () => {
    const user = { ...createUser(), phone: "+27821234567" };
    prisma.user.findFirst.mockResolvedValue(user);

    await service.login({
      identifier: "+27821234567",
      password: "irrelevant",
    } as never);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ phone: "+27821234567" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/backend`):
```bash
npx jest auth.service.spec.ts -t "phone-primary"
```
Expected: FAIL — `register()`/`login()` still only handle email today (TypeScript compile error on the `RegisterDto`/`LoginDto` shape, or a runtime failure once cast away with `as never`).

- [ ] **Step 3: Add identifier helpers and update `register()`**

In `apps/backend/src/modules/auth/auth.service.ts`, add two new private methods right after `findActiveUserByEmail` (around line 673–675):

```ts
  private async findActiveUserByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { phone, deletedAt: null } });
  }

  private classifyIdentifier(identifier: string): "email" | "phone" {
    return identifier.includes("@") ? "email" : "phone";
  }

  private async findActiveUserByIdentifier(
    identifier: string,
  ): Promise<User | null> {
    return this.classifyIdentifier(identifier) === "email"
      ? this.findActiveUserByEmail(this.normalizeEmail(identifier))
      : this.findActiveUserByPhone(identifier.trim());
  }
```

Replace `register()` (lines 70–102):

```ts
  async register(dto: RegisterInput): Promise<{ message: string }> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException("Provide an email or phone number");
    }

    const normalizedEmail = dto.email
      ? this.normalizeEmail(dto.email)
      : undefined;

    if (normalizedEmail) {
      const existingEmail = await this.findActiveUserByEmail(normalizedEmail);
      if (existingEmail) {
        throw new ConflictException("Email already registered");
      }
    }
    if (dto.phone) {
      const existingPhone = await this.findActiveUserByPhone(dto.phone);
      if (existingPhone) {
        throw new ConflictException("Phone number already registered");
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const emailVerificationToken = normalizedEmail
      ? randomBytes(32).toString("hex")
      : null;

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail ?? null,
        passwordHash,
        phone: dto.phone ?? null,
        emailVerified: false,
        emailVerificationToken,
      },
    });

    await this.ensureUserProfile(user.id);

    if (normalizedEmail) {
      await this.sendVerificationEmailForUser(
        user.email!,
        user.name,
        emailVerificationToken!,
      );
      return {
        message:
          "Registration successful. Please check your email to verify your account.",
      };
    }

    await this.issuePhoneVerificationOtp(user);
    return {
      message:
        "Registration successful. Please check your phone for a verification code.",
    };
  }
```

`issuePhoneVerificationOtp` is added in Task 6, which owns the phone-verification flow — leave a placeholder-free forward reference here (the method won't exist until Task 6 lands, so this task's own test run in Step 4 below only tests the phone-only branch's *shape* via mocks, not `issuePhoneVerificationOtp`'s real body).

Actually — to keep this task's test suite green without depending on Task 6, add a minimal private stub now that Task 6 replaces:

```ts
  private async issuePhoneVerificationOtp(_user: User): Promise<void> {
    // Replaced in Task 6 with a real OTP-issuing implementation.
  }
```

- [ ] **Step 4: Update `login()`**

Replace the start of `login()` (lines 104–110):

```ts
  async login(dto: LoginInput): Promise<LoginResult> {
    const user = await this.findActiveUserByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
```

(The rest of `login()` — password check, `emailVerified` gate, 2FA gate — is unchanged by this task; the `emailVerified` gate's phone-aware update is Task 6's job.)

- [ ] **Step 5: Update the DTO import aliases**

`AuthService` imports `LoginDto as LoginInput` and `RegisterDto as RegisterInput` from `../../common/dtos/auth.dto` — no change needed there, the aliases still point at the same (now-updated) classes.

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `apps/backend`):
```bash
npx jest auth.service.spec.ts
```
Expected: PASS, including the two new tests and everything pre-existing (update any pre-existing test that constructed a `LoginDto`-shaped object with `email` instead of `identifier`).

- [ ] **Step 7: Fix the controller call site and full compile**

`AuthController.login()` (`apps/backend/src/modules/auth/auth.controller.ts:66-83`) already just forwards `dto` to `authService.login(dto)` — no change needed there since the DTO shape change flows through automatically. Confirm:
```bash
npx tsc --noEmit
```
Expected: no errors remaining from Task 4's `identifier`/`email` shape change. (Some errors from other DTOs — `RequestOtpDto`, `VerifyOtpDto`, password-reset DTOs — are expected here only if you've already started Task 6's rename; if you followed this plan in order, those are untouched and should compile fine still using `email`.)

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/auth/auth.service.ts
git commit -m "feat(auth): identifier-based register/login lookup (email or phone)"
```

---

### Task 6: Phone verification flow + identifier support for OTP/password-reset DTOs

**Files:**
- Modify: `apps/backend/src/modules/auth/dto/request-otp.dto.ts`
- Modify: `apps/backend/src/modules/auth/dto/verify-otp.dto.ts`
- Modify: `apps/backend/src/modules/auth/dto/request-password-reset.dto.ts`
- Modify: `apps/backend/src/modules/auth/dto/password-reset-confirm.dto.ts`
- Modify: `apps/backend/src/modules/auth/auth.service.ts`
- Test: `apps/backend/src/modules/auth/__tests__/auth.service.spec.ts`

**Interfaces:**
- Consumes: `findActiveUserByIdentifier`, `classifyIdentifier` from Task 5.
- Produces: `AuthService.issuePhoneVerificationOtp(user)` (real implementation, replacing Task 5's stub); `login()` gates on `phoneVerified` for phone-only accounts the same way it gates on `emailVerified` for email accounts; `requestOtp`/`verifyOtp`/`requestPasswordReset`/`confirmPasswordReset` all accept `identifier` instead of `email`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/backend/src/modules/auth/__tests__/auth.service.spec.ts`:

```ts
describe("phone verification", () => {
  it("blocks login for an unverified phone-only account", async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...createUser(),
      email: null,
      phone: "+27821234567",
      phoneVerified: false,
    });

    await expect(
      service.login({
        identifier: "+27821234567",
        password: "hunter2!Aa",
      } as never),
    ).rejects.toThrow(/verify your phone/i);
  });

  it("issues a PHONE_VERIFICATION otp on phone-only registration", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const created = {
      ...createUser(),
      id: "user-3",
      email: null,
      phone: "+27821234567",
      phoneVerified: false,
    };
    prisma.user.create.mockResolvedValue(created);

    await service.register({
      name: "Thabo",
      password: "hunter2!Aa",
      phone: "+27821234567",
    } as never);

    expect(prisma.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-3",
          purpose: "PHONE_VERIFICATION",
        }),
      }),
    );
  });

  it("marks phoneVerified on successful PHONE_VERIFICATION otp consumption", async () => {
    const user = {
      ...createUser(),
      email: null,
      phone: "+27821234567",
      phoneVerified: false,
    };
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.otpCode.findFirst.mockResolvedValue({
      id: "otp-1",
      codeHash: await bcrypt.hash("654321", 10),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await service.verifyOtp({
      identifier: "+27821234567",
      purpose: "PHONE_VERIFICATION",
      code: "654321",
      deviceFingerprint: "fp-1",
    } as never);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        data: expect.objectContaining({ phoneVerified: true }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/backend`):
```bash
npx jest auth.service.spec.ts -t "phone verification"
```
Expected: FAIL — `login()` doesn't check `phoneVerified` yet, `issuePhoneVerificationOtp` is still Task 5's empty stub, `verifyOtp()` doesn't set `phoneVerified` and still looks up by `email` only.

- [ ] **Step 3: Rename `email` to `identifier` in the four DTOs**

`apps/backend/src/modules/auth/dto/request-otp.dto.ts` — replace the `email` field:

```ts
import { NotificationChannel, OtpPurpose } from "@prisma/client";
import {
  IsEnum,
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class RequestOtpDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @IsString()
  @Length(8, 256)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsIP(undefined, {
    message: "ipAddress must be a valid IPv4 or IPv6 address",
  })
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
```

`apps/backend/src/modules/auth/dto/verify-otp.dto.ts` — same rename:

```ts
import { NotificationChannel, OtpPurpose } from "@prisma/client";
import {
  IsEnum,
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class VerifyOtpDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @Length(8, 256)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsIP(undefined, {
    message: "ipAddress must be a valid IPv4 or IPv6 address",
  })
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
```

`apps/backend/src/modules/auth/dto/request-password-reset.dto.ts` — same rename (drop `IsEmail`, add `MinLength`):

```ts
import {
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";

export class RequestPasswordResetDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @Length(8, 256)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsIP(undefined, {
    message: "ipAddress must be a valid IPv4 or IPv6 address",
  })
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
```

`apps/backend/src/modules/auth/dto/password-reset-confirm.dto.ts` — same rename:

```ts
import { NotificationChannel } from "@prisma/client";
import {
  IsEnum,
  IsIP,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from "class-validator";

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @Length(8, 256)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsIP(undefined, {
    message: "ipAddress must be a valid IPv4 or IPv6 address",
  })
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      "newPassword must include upper and lower case letters, a number and a special character",
  })
  newPassword!: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
```

- [ ] **Step 4: Update `AuthService` to use `identifier` and add `phoneVerified` gating**

In `apps/backend/src/modules/auth/auth.service.ts`:

Task 5 added a private stub method:
```ts
  private async issuePhoneVerificationOtp(_user: User): Promise<void> {
    // Replaced in Task 6 with a real OTP-issuing implementation.
  }
```
Find that exact method (search for `issuePhoneVerificationOtp` — do not search by line number, earlier tasks have shifted line numbers throughout this file) and **replace its whole body in place** — do not add a second method with the same name, which would be a duplicate-declaration compile error. It reuses the exact same code/hash/deliver/create pattern `requestOtp()` already uses, minus the device-fingerprint rate-limiting (registration is already throttled at the controller level via `@Throttle({ auth: {} })`):

```ts
  private async issuePhoneVerificationOtp(user: User): Promise<void> {
    const code = this.generateOtpCode();
    const secret = this.generateOtpSecret();
    const codeHash = await bcrypt.hash(code, this.saltRounds);
    const expiresAt = this.getOtpExpirationDate();
    const delivery = await this.otpDeliveryService.deliver(
      user,
      {
        identifier: user.phone!,
        purpose: OtpPurpose.PHONE_VERIFICATION,
        deviceFingerprint: "registration",
        channel: NotificationChannel.SMS,
      },
      code,
    );

    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose: OtpPurpose.PHONE_VERIFICATION,
        secret,
        codeHash,
        expiresAt,
        channel: delivery.channel,
        deviceFingerprint: null,
        deliveryProvider: delivery.provider,
        deliveryReference: delivery.referenceId,
        deliveryMetadata: this.buildMetadata(delivery.metadata),
        deliveredAt: delivery.deliveredAt,
      },
    });
  }
```

Update `login()`'s verification gate (currently just the `emailVerified` check, right after the identifier lookup and password check):

```ts
    if (user.email && !user.emailVerified) {
      throw new UnauthorizedException(
        "Please verify your email before logging in. Check your inbox for the verification link.",
      );
    }
    if (!user.email && user.phone && !user.phoneVerified) {
      throw new UnauthorizedException(
        "Please verify your phone before logging in. Check your messages for the verification code.",
      );
    }
```

(Email-primary rule: when both exist, only `emailVerified` gates login — matches the spec's "phone not independently gated when email is present.")

Update `requestOtp()`'s user lookup (replace `this.findActiveUserByEmail(this.normalizeEmail(dto.email))` with):

```ts
    const user = await this.findActiveUserByIdentifier(dto.identifier);
```

and its early-return branch's channel default (was hardcoded `"EMAIL" as any` — now meaningful since `channel` on `OtpIssueResponse` should reflect a real default):

```ts
    if (!user) {
      return {
        message: "If an account exists, an OTP has been sent",
        channel: NotificationChannel.EMAIL,
        deliveredAt: new Date(),
      };
    }
```

Update `verifyOtp()`'s user lookup similarly:

```ts
  async verifyOtp(dto: VerifyOtpInput): Promise<AuthResponse> {
    const user = await this.findActiveUserByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException("Invalid code");
    }
```

and, after the existing `consumeOtp(...)` call inside `verifyOtp()`, add the `phoneVerified` side effect for the phone-verification purpose:

```ts
    if (dto.purpose === OtpPurpose.PHONE_VERIFICATION && !user.phoneVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      });
    }
```

Update `requestPasswordReset()`'s payload construction (it builds a `RequestOtpInput` internally):

```ts
  async requestPasswordReset(
    dto: RequestPasswordResetInput,
  ): Promise<OtpIssueResponse> {
    const payload: RequestOtpInput = {
      ...dto,
      purpose: OtpPurpose.PASSWORD_RESET,
    } satisfies RequestOtpInput;

    return this.requestOtp(payload);
  }
```

(No change needed here beyond what the type change already carries through — `dto.identifier` now flows into `payload.identifier` automatically via the spread.)

Update `confirmPasswordReset()`'s user lookup:

```ts
  async confirmPasswordReset(
    dto: PasswordResetConfirmInput,
  ): Promise<{ message: string }> {
    const user = await this.findActiveUserByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException("Invalid code");
    }
```

and its `consumeOtp(...)` call's inline object literal (was `{ email: dto.email, code: dto.code, ... }`) — update the field name:

```ts
    const consumedAt = await this.consumeOtp(
      user,
      {
        identifier: dto.identifier,
        code: dto.code,
        deviceFingerprint: dto.deviceFingerprint,
        ipAddress: dto.ipAddress,
        metadata: dto.metadata,
        purpose: OtpPurpose.PASSWORD_RESET,
        userAgent: dto.userAgent,
        channel,
      },
      { deviceFingerprint, channel },
    );
```

- [ ] **Step 5: Rename `email` to `identifier` in every `auth.flows.spec.ts` request body**

`apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts` has eight `.send({ email: ... })` call sites against the now-renamed DTOs, across four tests. Change each `email: user.email` (or `email: user.email` inside a nested object) to `identifier: user.email` in:

- The `"prefers EMAIL when the user has both identifiers..."` test (the one just renamed/fixed in Task 3) — line ~384's `.send({...})` for `POST /auth/otp/request`.
- `"issues and verifies OTP codes while recording device sessions"` — both the `POST /auth/otp/request` body (~line 406) and the `POST /auth/otp/verify` body (~line 425).
- `"resets passwords with OTP and enforces the new secret"` — the `POST /auth/password/reset/request` body (~line 452), the `POST /auth/password/reset/confirm` body (~line 462), and the `POST /auth/login` body (~line 475, which is `LoginDto`, already renamed in Task 4 — this one was likely already broken/fixed by Task 5's work, confirm it reads `identifier: user.email` not `email: user.email`).
- `"lists device sessions for an authenticated user"` — both the `POST /auth/otp/request` body (~line 495) and the `POST /auth/otp/verify` body (~line 505).

Each change is mechanical: `email: user.email` becomes `identifier: user.email` (the *value* — `user.email`, the field on the in-memory `UserRecord` fixture — is unrelated to this rename and stays as-is; only the request-body *key* changes).

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `apps/backend`):
```bash
npx jest auth.service.spec.ts auth.flows.spec.ts
```
Expected: PASS, all tests including the three new ones from Step 1 and the eight renamed call sites from Step 5.

- [ ] **Step 7: Full compile check**

```bash
npx tsc --noEmit
```
Expected: no errors. If `auth.controller.ts` still references `dto.email` for these endpoints, fix those call sites to use `dto.identifier` — they're pass-through call sites, not logic changes.

- [ ] **Step 8: Run the full auth test suite**

```bash
npx jest auth
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/auth/dto apps/backend/src/modules/auth/auth.service.ts apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts
git commit -m "feat(auth): phone verification via OTP, identifier-based OTP/password-reset flows"
```

---

### Task 7: Redis-backed TOTP lockout

**Files:**
- Modify: `apps/backend/src/modules/auth/auth.service.ts`
- Test: `apps/backend/src/modules/auth/__tests__/auth.service.spec.ts`

**Interfaces:**
- Consumes: `CacheService` (`apps/backend/src/common/services/cache.service.ts`, already globally provided by `CacheModule` — no module import change needed, matches the pattern already used in `apps/backend/src/modules/offers/offers.service.ts`).
- Produces: `checkTotpAttempts`/`recordTotpFailure`/`clearTotpAttempts` become `async` and Redis-backed instead of reading an in-process `Map`. No other method's signature changes — callers already `await` these where needed or don't (see Step 4).

- [ ] **Step 1: Write the failing test**

Add to `apps/backend/src/modules/auth/__tests__/auth.service.spec.ts`, in `beforeEach`'s existing service-construction block, add a mocked `CacheService`:

```ts
  let cache: jest.Mocked<CacheService>;
  // ... inside beforeEach, alongside the other mocks:
  cache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<CacheService>;
  service = new AuthService(
    prisma as unknown as PrismaService,
    jwtService,
    configService,
    usersService,
    otpDelivery,
    notifications,
    cache,
  );
```

(Adjust to match this file's exact existing `new AuthService(...)` call site and import `CacheService` from `"../../../common/services/cache.service"` at the top of the file.)

```ts
describe("TOTP lockout via Redis", () => {
  it("locks out after 5 failed attempts using the cache, not an in-process counter", async () => {
    cache.get.mockResolvedValue(undefined);
    prisma.user.findFirst.mockResolvedValue(createUser());

    for (let i = 0; i < 5; i++) {
      cache.get.mockResolvedValueOnce({ count: i, lockedUntil: null });
    }

    // Simulate the 5th failure triggering a lock — assert the service
    // writes the lock state to the cache, not to any local field.
    await (service as unknown as {
      recordTotpFailure: (userId: string) => Promise<void>;
    }).recordTotpFailure("user-1");

    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining("user-1"),
      expect.objectContaining({ lockedUntil: expect.any(Number) }),
      expect.any(Number),
    );
  });

  it("rejects a 2FA attempt when the cache reports an active lock", async () => {
    cache.get.mockResolvedValue({
      count: 0,
      lockedUntil: Date.now() + 60_000,
    });

    await expect(
      (service as unknown as {
        checkTotpAttempts: (userId: string) => Promise<void>;
      }).checkTotpAttempts("user-1"),
    ).rejects.toThrow(/too many failed attempts/i);
  });
});

describe("initSetup2FA QR label for phone-only users", () => {
  // `PrismaMock` (top of this file) only declares `user.findFirst` and
  // `user.create` — `initSetup2FA()` calls `prisma.user.findUniqueOrThrow`
  // and `prisma.user.update`, neither mocked yet anywhere in this file.
  // Add both to `PrismaMock`'s type and to the `prisma.user` object built
  // in `beforeEach` (as `jest.fn()`, alongside the existing `findFirst`/
  // `create`) before writing this test — otherwise `prisma.user.findUniqueOrThrow`
  // is `undefined` and the test throws a TypeError, not a meaningful failure.

  it("uses phone as the TOTP QR label when email is null", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      ...createUser(),
      email: null,
      phone: "+27821234567",
      twoFactorEnabled: false,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.initSetup2FA("user-1");

    expect(result.qrCode).toBeDefined();
    // The QR code encodes the label via otplib's keyuri — decoding the
    // data URL isn't necessary here; this test's real job is proving
    // initSetup2FA() doesn't throw/crash on a null email, which it would
    // if `authenticator.keyuri(user.email, ...)` were called with `null`.
  });
});

describe("2FA completion for phone-only users", () => {
  it("completeTwoFactorLogin() succeeds for a phone-only user (no redundant email re-lookup)", async () => {
    const phoneOnlyUser = {
      ...createUser(),
      email: null,
      phone: "+27821234567",
      twoFactorEnabled: true,
      twoFactorSecret: "JBSWY3DPEHPK3PXP",
    };
    cache.get.mockResolvedValue(undefined);
    prisma.user.findUniqueOrThrow.mockResolvedValue(phoneOnlyUser);
    prisma.user.update.mockResolvedValue(phoneOnlyUser);
    jest.spyOn(authenticator, "verify").mockReturnValue(true);

    // Before this task's fix, this call would either fail to compile
    // (findActiveUserByEmail expects a string, user.email is null) or, if
    // "fixed" with a bare non-null assertion instead of removing the
    // redundant re-fetch, throw at runtime for exactly this user.
    await expect(
      service.completeTwoFactorLogin(phoneOnlyUser.id, "123456"),
    ).resolves.toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/backend`):
```bash
npx jest auth.service.spec.ts -t "TOTP lockout"
npx jest auth.service.spec.ts -t "initSetup2FA QR label"
```
Expected: both FAIL. The TOTP-lockout tests fail because `AuthService`'s constructor doesn't accept a `CacheService` yet, and `checkTotpAttempts`/`recordTotpFailure` are synchronous methods reading a `Map`, not `cache.get`/`cache.set`. The QR-label test fails at compile/type-check time (or throws at runtime, depending on how strictly this file's mocks are typed) because `authenticator.keyuri(user.email, ...)` is still called with `user.email` directly, and `user.email` is `null` in this fixture — confirming the tsc error this step exists to fix (see Ruling in the SDD ledger after Task 1's review).

- [ ] **Step 3: Inject `CacheService` and rewrite the lockout methods**

In `apps/backend/src/modules/auth/auth.service.ts`:

Add the import:
```ts
import { CacheService } from "../../common/services/cache.service";
```

Remove the in-process state (lines 54–59):
```ts
  private readonly saltRounds = 10;
  private readonly TOTP_MAX_ATTEMPTS = 5;
  private readonly TOTP_LOCK_MS = 15 * 60 * 1000;
```
(delete the `totpAttempts` `Map` field entirely)

Add `CacheService` to the constructor:
```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly otpDeliveryService: OtpDeliveryService,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
  ) {}
```

Replace the three lockout methods (lines 136–158):

```ts
  private totpLockKey(userId: string): string {
    return `auth:totp-lock:${userId}`;
  }

  private async checkTotpAttempts(userId: string): Promise<void> {
    const entry = await this.cache.get<{
      count: number;
      lockedUntil: number | null;
    }>(this.totpLockKey(userId));
    if (entry?.lockedUntil && Date.now() < entry.lockedUntil) {
      throw new UnauthorizedException(
        "Too many failed attempts — try again later",
      );
    }
  }

  private async recordTotpFailure(userId: string): Promise<void> {
    const entry = (await this.cache.get<{
      count: number;
      lockedUntil: number | null;
    }>(this.totpLockKey(userId))) ?? { count: 0, lockedUntil: null };
    entry.count += 1;
    if (entry.count >= this.TOTP_MAX_ATTEMPTS) {
      entry.lockedUntil = Date.now() + this.TOTP_LOCK_MS;
      entry.count = 0;
    }
    await this.cache.set(this.totpLockKey(userId), entry, this.TOTP_LOCK_MS);
  }

  private async clearTotpAttempts(userId: string): Promise<void> {
    await this.cache.delete(this.totpLockKey(userId));
  }
```

- [ ] **Step 4: Await the now-async calls at every call site**

`checkTotpAttempts`/`recordTotpFailure`/`clearTotpAttempts` are called from `completeTwoFactorLogin()` and `verifySetup2FA()` (and `disable2FA()` doesn't use them). Add `await` at each call site — e.g. in `completeTwoFactorLogin()`:

```ts
  async completeTwoFactorLogin(
    userId: string,
    code: string,
    dto: Partial<
      Pick<
        LoginInput,
        "rememberMe" | "deviceFingerprint" | "ipAddress" | "userAgent"
      >
    > & { metadata?: Record<string, unknown> } = {},
  ): Promise<AuthResponse> {
    await this.checkTotpAttempts(userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const valid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret!,
    });
    if (!valid) {
      const idx = (user.twoFactorBackupCodes ?? []).findIndex(
        (h) => h === createHash("sha256").update(code).digest("hex"),
      );
      if (idx === -1) {
        await this.recordTotpFailure(userId);
        throw new UnauthorizedException("Invalid authentication code");
      }
      const remaining = [...(user.twoFactorBackupCodes ?? [])];
      remaining.splice(idx, 1);
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: remaining },
      });
    } else {
      await this.clearTotpAttempts(userId);
    }

    // The method used to re-fetch `fullUser` via
    // `this.findActiveUserByEmail(user.email)` here — redundant (the `user`
    // fetched above via `findUniqueOrThrow` is already the full record) and,
    // since `User.email` is nullable as of Task 1, broken outright for a
    // phone-only user: `findActiveUserByEmail(null)` would either type-error
    // or (once "fixed" with a bare `!` assertion) throw at runtime for
    // every phone-only account. Use `user` directly instead.
    const response = await this.buildAuthResponse(user, {
      rememberMe: dto.rememberMe,
      sessionFingerprint: this.resolveDeviceIdentifier(
        dto.deviceFingerprint,
        dto.ipAddress,
      ),
      sessionMetadata: dto.metadata,
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    return response;
  }
```

Apply the identical three-call-site change to `verifySetup2FA()` — its body has the same shape (checks attempts first, records a failure on an invalid code, clears on success) — and it has the exact same redundant/broken `findActiveUserByEmail(user.email)` re-fetch at its tail, fixed the same way:

```ts
  async verifySetup2FA(
    userId: string,
    code: string,
    loginDto: Partial<
      Pick<
        LoginInput,
        "rememberMe" | "deviceFingerprint" | "ipAddress" | "userAgent"
      >
    > & { metadata?: Record<string, unknown> } = {},
  ): Promise<AuthResponse & { backupCodes: string[] }> {
    await this.checkTotpAttempts(userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorSecret)
      throw new BadRequestException("2FA setup not initiated");
    if (user.twoFactorEnabled)
      throw new ForbiddenException("2FA already enabled");

    const valid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });
    if (!valid) {
      await this.recordTotpFailure(userId);
      throw new UnauthorizedException(
        "Invalid authentication code. Try again.",
      );
    }
    await this.clearTotpAttempts(userId);

    // Generate 8 backup codes
    const plainCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString("hex").toUpperCase().match(/.{4}/g)!.join("-"),
    );
    const hashedCodes = plainCodes.map((c) =>
      createHash("sha256").update(c).digest("hex"),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashedCodes },
    });

    // Same fix as completeTwoFactorLogin() above: use `user` directly
    // instead of the old redundant/broken `findActiveUserByEmail(user.email)`
    // re-fetch, which doesn't type-check for a nullable email and would
    // throw at runtime for a phone-only user regardless.
    const response = await this.buildAuthResponse(user, {
      rememberMe: loginDto.rememberMe,
      sessionFingerprint: this.resolveDeviceIdentifier(
        loginDto.deviceFingerprint,
        loginDto.ipAddress,
      ),
      sessionMetadata: loginDto.metadata,
      userAgent: loginDto.userAgent,
      ipAddress: loginDto.ipAddress,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    return { ...response, backupCodes: plainCodes };
  }
```

- [ ] **Step 5: Fix `initSetup2FA()`'s TOTP QR label for phone-only users**

`User.email` is now nullable (Task 1), so `initSetup2FA()`'s `authenticator.keyuri(user.email, "Forumo", secret)` call no longer type-checks — `keyuri`'s first argument (the label shown inside the authenticator app, e.g. Google Authenticator) is typed `string`. Find that line and change it to fall back through the identifiers a user might have:

```ts
    const secret = authenticator.generateSecret();
    const accountLabel = user.email ?? user.phone ?? user.id;
    const otpAuthUrl = authenticator.keyuri(accountLabel, "Forumo", secret);
    const qrCode = await QRCode.toDataURL(otpAuthUrl);
```

(`user.id` as the final fallback is unreachable in practice — every account has at least one of email/phone per the `AtLeastOneIdentifier` constraint from Task 4 — but keeps the parameter genuinely non-nullable without an unsafe assertion.)

- [ ] **Step 6: Update `AuthModule`'s provider list if needed**

`CacheModule` is `@Global()` (`apps/backend/src/common/services/cache.module.ts:8`), so `CacheService` is already injectable anywhere without adding an import to `AuthModule`. No change needed to `apps/backend/src/modules/auth/auth.module.ts`.

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `apps/backend`):
```bash
npx jest auth.service.spec.ts
```
Expected: PASS, including the two new tests.

- [ ] **Step 8: Full compile + auth suite check**

```bash
npx tsc --noEmit
npx jest auth
```
Expected: no `auth.service.ts` errors. Task 14 (dispatched earlier in this run, right after Task 1) already swept the cross-module `User.email`-nullable fallout in `admin.service.ts`/`auction-end.processor.ts`/`escrow.service.ts`, and Task 3 fixed `otp-delivery.service.ts` — so at this point `npx tsc --noEmit` should be fully clean, zero errors anywhere, not just in the files this task touched. If it isn't, that's a real regression to fix before committing, not an expected/deferred gap. All auth tests pass. `auth.flows.spec.ts` constructs its own `Test.createTestingModule` — if it doesn't provide/override `CacheService`, check whether the real `CacheModule` is pulled in transitively (it's global, so it will be) and whether that test file's Redis connection needs mocking; if `CacheService`'s real Redis client fails to connect in the test environment, it already degrades gracefully (`CacheService` logs a warning and returns `undefined`/no-ops on failure — see `apps/backend/src/common/services/cache.service.ts:44-47`), so tests should still pass, just without real lockout persistence. Confirm this is actually what happens rather than assuming it.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/auth/auth.service.ts
git commit -m "fix(auth): move TOTP lockout counter from in-process Map to Redis"
```

---

### Task 8: 2FA OTP fallback endpoints

**Files:**
- Modify: `apps/backend/src/modules/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.controller.ts`
- Test: `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts`

**Interfaces:**
- Consumes: `TwoFactorPendingGuard` (existing, unchanged), `OtpPurpose.MFA` (existing enum value, previously unused).
- Produces: `POST /auth/2fa/otp/request`, `POST /auth/2fa/otp/verify` — both consumed by Task 2's `ForumoApiClient.auth.request2FAOtp`/`verify2FAOtp` (frontend, Task 11).

- [ ] **Step 1: Extend the in-memory Prisma test harness with 2FA fields**

`apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts`'s `UserRecord` type and `InMemoryPrismaService.user.create()` don't carry `twoFactorEnabled`/`twoFactorSecret`/`twoFactorBackupCodes` today — nothing in this file has exercised 2FA yet. Add them.

In the `UserRecord` type (around line 45–60), add three fields:

```ts
type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  trustScore: number;
  kycStatus: string;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorBackupCodes: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
```

In `InMemoryPrismaService.user.create()` (around line 114–140), add the same three fields to the constructed `record`, defaulted from `data`:

```ts
      const record: UserRecord = {
        id,
        name: data.name ?? "Test User",
        email: data.email!,
        passwordHash: data.passwordHash!,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        phone: (data as any).phone ?? null,
        avatarUrl: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        role: (data as any).role ?? UserRole.BUYER,
        trustScore: 0,
        kycStatus: "PENDING",
        emailVerified: (data as any).emailVerified ?? true,
        emailVerificationToken: (data as any).emailVerificationToken ?? null,
        twoFactorEnabled: (data as any).twoFactorEnabled ?? false,
        twoFactorSecret: (data as any).twoFactorSecret ?? null,
        twoFactorBackupCodes: (data as any).twoFactorBackupCodes ?? [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
```

- [ ] **Step 2: Write the failing integration tests**

Add to `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts`, as a new `describe` block inside the existing `describe("AuthModule HTTP flows", ...)` block (it needs the outer block's `app`/`prisma`/`authService` from `beforeEach`):

```ts
  describe("POST /auth/2fa/otp/request and /auth/2fa/otp/verify", () => {
    it("rejects the OTP fallback during 2FA setup (not yet enrolled)", async () => {
      const user = await createUser(prisma, { twoFactorEnabled: false });
      const setupToken = await authService.issueTwoFactorToken(user.id, true);

      const res = await request(app.getHttpServer())
        .post("/auth/2fa/otp/request")
        .set("Authorization", `Bearer ${setupToken}`)
        .expect(400);
      expect(res.body.message).toMatch(/setup/i);
    });

    it("completes login via SMS/email OTP after TOTP is already enrolled", async () => {
      const user = await createUser(prisma, {
        twoFactorEnabled: true,
        twoFactorSecret: "JBSWY3DPEHPK3PXP",
      });
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        .spyOn<any, string>(authService as any, "generateOtpCode")
        .mockReturnValue("222444");
      const pendingToken = await authService.issueTwoFactorToken(
        user.id,
        false,
      );

      const requestRes = await request(app.getHttpServer())
        .post("/auth/2fa/otp/request")
        .set("Authorization", `Bearer ${pendingToken}`)
        .expect(201);
      expect(requestRes.body.channel).toBeDefined();

      const verifyRes = await request(app.getHttpServer())
        .post("/auth/2fa/otp/verify")
        .set("Authorization", `Bearer ${pendingToken}`)
        .send({ code: "222444" })
        .expect(201);
      expect(verifyRes.body.accessToken).toBeDefined();
    });
  });
```

This uses the exact pattern already established elsewhere in this same file (e.g. the `"resets passwords with OTP..."` test) — `jest.spyOn(authService as any, "generateOtpCode")` to make the OTP code deterministic, rather than trying to extract it from mocked delivery metadata. `authService.issueTwoFactorToken(userId, setupRequired)` is an existing public method (`auth.service.ts`, used internally by `login()`), called directly here to mint a pending token without needing a full password-login round trip.

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `apps/backend`):
```bash
npx jest auth.flows.spec.ts -t "2fa/otp"
```
Expected: FAIL — both endpoints return 404, they don't exist yet.

- [ ] **Step 4: Add the service methods**

In `apps/backend/src/modules/auth/auth.service.ts`, add two new public methods near `completeTwoFactorLogin`:

```ts
  async requestTwoFactorOtp(userId: string): Promise<OtpIssueResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const deviceFingerprint = "2fa-fallback";
    await this.enforceDeviceRateLimit(user.id, deviceFingerprint);
    await this.enforceOtpCooldown(user.id, OtpPurpose.MFA, deviceFingerprint);

    const code = this.generateOtpCode();
    const secret = this.generateOtpSecret();
    const codeHash = await bcrypt.hash(code, this.saltRounds);
    const expiresAt = this.getOtpExpirationDate();
    const delivery = await this.otpDeliveryService.deliver(
      user,
      {
        identifier: user.email ?? user.phone!,
        purpose: OtpPurpose.MFA,
        deviceFingerprint,
      },
      code,
    );

    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose: OtpPurpose.MFA,
        secret,
        codeHash,
        expiresAt,
        channel: delivery.channel,
        deviceFingerprint,
        deliveryProvider: delivery.provider,
        deliveryReference: delivery.referenceId,
        deliveryMetadata: this.buildMetadata(delivery.metadata),
        deliveredAt: delivery.deliveredAt,
      },
    });

    return {
      message: "OTP issued",
      channel: delivery.channel,
      deliveredAt: delivery.deliveredAt,
    };
  }

  async completeTwoFactorOtpLogin(
    userId: string,
    code: string,
    dto: Partial<
      Pick<
        LoginInput,
        "rememberMe" | "deviceFingerprint" | "ipAddress" | "userAgent"
      >
    > = {},
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.MFA,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!otpRecord || otpRecord.attempts >= 3) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    const matches = await bcrypt.compare(code, otpRecord.codeHash);
    if (!matches) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid or expired code");
    }
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt: new Date() },
    });

    const response = await this.buildAuthResponse(user, {
      rememberMe: dto.rememberMe,
      sessionFingerprint: this.resolveDeviceIdentifier(
        dto.deviceFingerprint,
        dto.ipAddress,
      ),
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    return response;
  }
```

- [ ] **Step 5: Add the controller endpoints**

In `apps/backend/src/modules/auth/auth.controller.ts`, add two new endpoints right after `twoFactorVerify` (before `twoFactorDisable`):

```ts
  @Post("2fa/otp/request")
  @UseGuards(TwoFactorPendingGuard)
  @Throttle({ "auth-otp": {} })
  async twoFactorOtpRequest(@Req() req: AuthenticatedRequest) {
    if (req.twoFactorSetupRequired) {
      throw new BadRequestException(
        "2FA not set up yet; use /auth/2fa/setup-init first",
      );
    }
    return this.authService.requestTwoFactorOtp(req.twoFactorUserId!);
  }

  @Post("2fa/otp/verify")
  @UseGuards(TwoFactorPendingGuard)
  @Throttle({ "auth-otp": {} })
  async twoFactorOtpVerify(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { code: string; rememberMe?: boolean; deviceFingerprint?: string },
  ) {
    if (req.twoFactorSetupRequired) {
      throw new BadRequestException(
        "2FA not set up yet; use /auth/2fa/setup-init first",
      );
    }
    const result = await this.authService.completeTwoFactorOtpLogin(
      req.twoFactorUserId!,
      body.code,
      {
        rememberMe: body.rememberMe,
        deviceFingerprint: body.deviceFingerprint,
        ipAddress: req.ip ?? undefined,
        userAgent:
          (req.headers?.["user-agent"] as string | undefined) ?? undefined,
      },
    );
    await this.auditLog.record({
      actorId: result.user.id,
      action: "auth.login",
      entityType: "user",
      entityId: result.user.id,
      payload: { via: "2fa-otp" },
      ipAddress: req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
    return result;
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `apps/backend`):
```bash
npx jest auth.flows.spec.ts -t "2fa/otp"
```
Expected: PASS, both tests.

- [ ] **Step 7: Full auth suite + compile check**

```bash
npx tsc --noEmit
npx jest auth
```
Expected: no errors, all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/auth/auth.service.ts apps/backend/src/modules/auth/auth.controller.ts apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts
git commit -m "feat(auth): SMS/email OTP fallback for the mandatory 2FA login gate"
```

---

### Task 9: OAuth account recovery flow

**Files:**
- Modify: `apps/backend/src/modules/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.controller.ts`
- Test: `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts`

**Interfaces:**
- Consumes: `passwordSetupRequiredSchema` shape from Task 2 (frontend consumes it in Task 11).
- Produces: `LoginResult` union gains `{ passwordSetupRequired: true; recoveryToken: string }`; `POST /auth/recover-oauth-account/request`, `POST /auth/recover-oauth-account/confirm`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/backend/src/modules/auth/__tests__/auth.service.spec.ts`:

```ts
describe("OAuth account recovery", () => {
  it("returns passwordSetupRequired instead of the normal 2FA gate for passwordHash === ''", async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...createUser(),
      passwordHash: "",
    });

    const result = await service.login({
      identifier: "zuri@example.com",
      password: "anything",
    } as never);

    expect(result).toEqual(
      expect.objectContaining({ passwordSetupRequired: true }),
    );
  });
});
```

Add to `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts`, as a new `describe` block inside `describe("AuthModule HTTP flows", ...)`:

```ts
  describe("POST /auth/recover-oauth-account", () => {
    it("returns a generic message whether or not the account exists", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/recover-oauth-account/request")
        .send({ email: "nobody@example.com" })
        .expect(201);
      expect(res.body.message).toMatch(/if an account exists/i);
    });

    it("confirms recovery, sets a password, and routes into 2FA setup", async () => {
      const user = await createUser(prisma, { passwordHash: "" });
      jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Prisma mock requires flexible typing, refine to specific Prisma types when schema stabilizes
        .spyOn<any, string>(authService as any, "generateOtpCode")
        .mockReturnValue("555666");

      await request(app.getHttpServer())
        .post("/auth/recover-oauth-account/request")
        .send({ email: user.email })
        .expect(201);

      const confirmRes = await request(app.getHttpServer())
        .post("/auth/recover-oauth-account/confirm")
        .send({
          email: user.email,
          code: "555666",
          newPassword: "NewHunter2!Aa",
        })
        .expect(201);

      expect(confirmRes.body.twoFactorSetupRequired).toBe(true);
      expect(prisma.users.get(user.id)?.passwordHash).not.toBe("");
    });
  });
```

`createUser(prisma, { passwordHash: "" })` works because `createUser`'s own default (`overrides.passwordHash ?? await bcrypt.hash(...)`) only replaces `null`/`undefined` — an explicit empty string passes through unchanged, correctly seeding the OAuth sentinel.

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/backend`):
```bash
npx jest auth.service.spec.ts auth.flows.spec.ts -t "recover"
```
Expected: FAIL — `login()` doesn't check for `passwordHash === ""` yet; the two endpoints return 404.

- [ ] **Step 3: Add the `passwordSetupRequired` branch to `login()`**

In `apps/backend/src/modules/auth/auth.service.ts`, update the `LoginResult` type:

```ts
export type LoginResult =
  | { twoFactorRequired: true; twoFactorToken: string }
  | { twoFactorSetupRequired: true; twoFactorToken: string }
  | { passwordSetupRequired: true; recoveryToken: string }
  | AuthResponse;
```

In `login()`, insert a new check right after the identifier lookup, before the password comparison:

```ts
    const user = await this.findActiveUserByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.passwordHash === "") {
      const recoveryToken = await this.jwtService.signAsync(
        { sub: user.id, accountRecoveryPending: true },
        {
          secret: this.configService.getOrThrow<string>("JWT_SECRET"),
          expiresIn: 300,
        },
      );
      return { passwordSetupRequired: true, recoveryToken };
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
```

- [ ] **Step 4: Add the two recovery service methods**

Add near `requestPasswordReset`/`confirmPasswordReset`:

```ts
  async requestOAuthAccountRecovery(email: string): Promise<{ message: string }> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(email));
    const generic = {
      message: "If an account exists and needs recovery, a code has been sent.",
    };
    if (!user || user.passwordHash !== "") {
      return generic;
    }

    const code = this.generateOtpCode();
    const secret = this.generateOtpSecret();
    const codeHash = await bcrypt.hash(code, this.saltRounds);
    const expiresAt = this.getOtpExpirationDate();
    const delivery = await this.otpDeliveryService.deliver(
      user,
      {
        identifier: user.email!,
        purpose: OtpPurpose.ACCOUNT_RECOVERY,
        deviceFingerprint: "oauth-recovery",
        channel: NotificationChannel.EMAIL,
      },
      code,
    );

    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose: OtpPurpose.ACCOUNT_RECOVERY,
        secret,
        codeHash,
        expiresAt,
        channel: delivery.channel,
        deviceFingerprint: null,
        deliveryProvider: delivery.provider,
        deliveryReference: delivery.referenceId,
        deliveryMetadata: this.buildMetadata(delivery.metadata),
        deliveredAt: delivery.deliveredAt,
      },
    });

    return generic;
  }

  async confirmOAuthAccountRecovery(
    email: string,
    code: string,
    newPassword: string,
    phone?: string,
  ): Promise<{ twoFactorSetupRequired: true; twoFactorToken: string }> {
    const user = await this.findActiveUserByEmail(this.normalizeEmail(email));
    if (!user || user.passwordHash !== "") {
      throw new UnauthorizedException("Invalid code");
    }

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.ACCOUNT_RECOVERY,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!otpRecord || otpRecord.attempts >= 3) {
      throw new UnauthorizedException("Invalid code");
    }
    const matches = await bcrypt.compare(code, otpRecord.codeHash);
    if (!matches) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid code");
    }
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt: new Date() },
    });

    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        phone: phone ?? user.phone,
        tokenVersion: { increment: 1 },
      },
    });

    const twoFactorToken = await this.issueTwoFactorToken(user.id, true);
    return { twoFactorSetupRequired: true, twoFactorToken };
  }
```

- [ ] **Step 5: Add the two controller endpoints**

In `apps/backend/src/modules/auth/auth.controller.ts`, add after `resendVerification`:

```ts
  @Post("recover-oauth-account/request")
  @Throttle({ "auth-password-reset": {} })
  async recoverOAuthAccountRequest(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException("email is required");
    return this.authService.requestOAuthAccountRecovery(body.email);
  }

  @Post("recover-oauth-account/confirm")
  @Throttle({ "auth-password-reset": {} })
  async recoverOAuthAccountConfirm(
    @Body()
    body: {
      email: string;
      code: string;
      newPassword: string;
      phone?: string;
    },
  ) {
    return this.authService.confirmOAuthAccountRecovery(
      body.email,
      body.code,
      body.newPassword,
      body.phone,
    );
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx jest auth.service.spec.ts auth.flows.spec.ts -t "recover"
```
Expected: PASS.

- [ ] **Step 7: Full compile + auth suite**

```bash
npx tsc --noEmit
npx jest auth
```
Expected: no errors, all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/auth/auth.service.ts apps/backend/src/modules/auth/auth.controller.ts apps/backend/src/modules/auth/__tests__
git commit -m "feat(auth): recovery flow for existing Google-OAuth accounts (set password, enroll 2FA)"
```

---

### Task 10: Remove Google OAuth (backend)

**Files:**
- Delete: `apps/backend/src/modules/auth/strategies/google.strategy.ts`
- Delete: `apps/backend/src/modules/auth/guards/google-auth.guard.ts`
- Delete: `apps/backend/src/modules/auth/guards/google-auth.guard.spec.ts`
- Modify: `apps/backend/src/modules/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.controller.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts` (drop `GOOGLE_*` fake-config entries)

**Interfaces:**
- Removes public surface: `validateOrCreateGoogleUser`, `/auth/google`, `/auth/google/callback`, `/auth/oauth/exchange`. Nothing later in this plan depends on any of it — Task 11 (web) is the only consumer and is updated in lockstep conceptually, though it can land as its own commit.

- [ ] **Step 1: Delete the Google-specific files**

```bash
git rm apps/backend/src/modules/auth/strategies/google.strategy.ts
git rm apps/backend/src/modules/auth/guards/google-auth.guard.ts
git rm apps/backend/src/modules/auth/guards/google-auth.guard.spec.ts
```

- [ ] **Step 2: Remove `validateOrCreateGoogleUser` from `AuthService`**

Nine prior tasks have added methods to `apps/backend/src/modules/auth/auth.service.ts`, so line numbers from the original file no longer apply — locate by content instead. Find and delete the entire method, which starts with this signature and ends at its closing brace (originally in the file's later section, near `issueTwoFactorToken`/`initSetup2FA`):

```ts
  async validateOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<User> {
```

Delete that method in full, including its trailing blank line before the next method (`issueTwoFactorToken` or whichever method now follows it).

- [ ] **Step 3: Remove the three Google endpoints from `AuthController`**

Same caveat — locate by content, not line number. Delete the three handlers whose decorators are `@Get("google")`, `@Get("google/callback")`, and `@Get("oauth/exchange")` (the last one is named `exchangeOAuthCookie`), each including its full method body and the `// ─── ...` comment banner if one directly precedes only these three (do not delete a banner shared with unrelated code that follows). Remove the now-unused `GoogleAuthGuard` import at the top of the file (`import { GoogleAuthGuard } from "./guards/google-auth.guard";`).

- [ ] **Step 4: Remove `GoogleStrategy` from `AuthModule`**

In `apps/backend/src/modules/auth/auth.module.ts`, remove the `import { GoogleStrategy } from "./strategies/google.strategy";` line and remove `GoogleStrategy` from the `providers` array.

- [ ] **Step 5: Remove the dependency**

```bash
cd apps/backend
npm uninstall passport-google-oauth20 @types/passport-google-oauth20 --no-save
```
Then manually remove the two corresponding lines from `apps/backend/package.json`'s `dependencies` and `devDependencies` (the `--no-save` flag above avoids `npm` rewriting the whole lockfile in this pnpm workspace — the manual `package.json` edit is the actual change; regenerate the lockfile properly in Step 7).

- [ ] **Step 6: Remove the env vars from `.env.example`**

Delete the three `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` lines from `apps/backend/.env.example`.

- [ ] **Step 7: Regenerate the lockfile**

From the repo root:
```bash
pnpm install
```
Expected: `passport-google-oauth20` and its types disappear from `pnpm-lock.yaml`'s backend entries; no other dependency changes.

- [ ] **Step 8: Clean up the test file's fake Google config**

In `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts`, two separate spots reference Google env vars — remove both:
- `FakeConfigService`'s `values` object (lines 27–29): delete the `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL` entries.
- The outer `describe("AuthModule HTTP flows", ...)` block's `beforeEach` (lines 326–328): delete the `process.env.GOOGLE_CLIENT_ID = "test-google-id";` and `process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";` lines (keep `process.env.JWT_SECRET = "test-jwt-secret";`) — they were only ever set because `GoogleStrategy`'s constructor read `process.env` directly as a fallback; nothing reads them once `GoogleStrategy` is deleted.

- [ ] **Step 9: Run the full backend suite**

```bash
cd apps/backend
npx tsc --noEmit
npx jest
```
Expected: no compile errors, no test referencing Google OAuth remains (if any test file still imports `GoogleStrategy`/`GoogleAuthGuard`, delete that test file's Google-specific cases — they were testing code that no longer exists).

- [ ] **Step 10: Manually verify no reference survives**

```bash
grep -ril "google" apps/backend/src --include="*.ts" | grep -v node_modules
```
Expected: no output (or only unrelated matches, e.g. a comment mentioning an unrelated third party — inspect anything that shows up).

- [ ] **Step 11: Commit**

```bash
git add -A apps/backend/src/modules/auth apps/backend/package.json apps/backend/.env.example pnpm-lock.yaml
git commit -m "feat(auth): remove Google OAuth (backend)"
```

---

### Task 11: Web — remove Google OAuth UI, identifier-based login form, password-setup handling

**Files:**
- Delete: `apps/web/src/components/google-signin-button.tsx`
- Delete: `apps/web/src/app/auth/callback/oauth-callback.tsx`
- Delete: `apps/web/src/app/auth/callback/page.tsx` (if it exists solely to render `OAuthCallback` — confirm and remove the whole route if so)
- Modify: `apps/web/src/app/login/signin-form.tsx`

**Interfaces:**
- Consumes: `ForumoApiClient.auth.login()` (Task 2, now takes `{ identifier, password }`), `PasswordSetupRequired` type (Task 2).

- [ ] **Step 1: Confirm the callback route's only purpose**

Run:
```bash
grep -rn "oauth-callback\|OAuthCallback" apps/web/src
```
Expected: only `apps/web/src/app/auth/callback/oauth-callback.tsx` and whatever `page.tsx` renders it. If a `page.tsx` in that directory imports and renders `<OAuthCallback />` and nothing else, delete both files and the now-empty `apps/web/src/app/auth/callback/` directory. If `page.tsx` does anything else, stop and reassess before deleting (this plan assumes it doesn't, per the spec's discovery, but confirm before removing a route).

- [ ] **Step 2: Delete the Google button and callback route**

```bash
git rm apps/web/src/components/google-signin-button.tsx
git rm apps/web/src/app/auth/callback/oauth-callback.tsx
git rm apps/web/src/app/auth/callback/page.tsx
```

- [ ] **Step 3: Update the login form**

Replace `apps/web/src/app/login/signin-form.tsx` in full:

```tsx
"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../lib/api-client";
import { set2FaToken } from "../../lib/2fa-store";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/app";
  const api = createApiClient();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resetSuccess = searchParams?.get("reset") === "success";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.auth.login({ identifier, password });

      // ── OAuth-account recovery gate ──────────────────────────────────────
      if ("passwordSetupRequired" in result) {
        router.push(
          (`/login/recover-account?token=${encodeURIComponent(
            result.recoveryToken,
          )}&email=${encodeURIComponent(identifier)}`) as any,
        );
        return;
      }

      // ── 2FA gate ────────────────────────────────────────────────────────
      if ("twoFactorToken" in result) {
        set2FaToken(result.twoFactorToken, callbackUrl);

        if ("twoFactorSetupRequired" in result) {
          router.push("/login/2fa?mode=setup" as any);
        } else {
          router.push("/login/2fa?mode=verify" as any);
        }
        return;
      }

      // ── Full auth response (should not happen if 2FA is mandatory) ──────
      const nextAuthResult = await signIn("token-auth", {
        token: result.accessToken,
        redirect: false,
        callbackUrl,
      });
      if (nextAuthResult?.error) throw new Error(nextAuthResult.error);
      router.push((nextAuthResult?.url ?? callbackUrl) as any);
      router.refresh();
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      const genericMessage = err instanceof Error ? err.message : null;
      setError(
        apiErrorMessage ||
          genericMessage ||
          "Unable to sign in. Double-check your credentials.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 card card-pad">
      {resetSuccess ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[color:var(--escrow)]">
          Password reset successfully. Sign in with your new password.
        </p>
      ) : null}
      <label className="space-y-2 text-sm">
        <span className="subtle">Email or phone</span>
        <input
          type="text"
          className="input-forumo"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="you@example.com or +27821234567"
          required
        />
      </label>
      <label className="space-y-2 text-sm">
        <span className="subtle">Password</span>
        <input
          type="password"
          className="input-forumo"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
        />
      </label>
      <div className="flex justify-end">
        <Link
          className="text-xs text-[color:var(--accent)] hover:underline"
          href="/forgot-password"
        >
          Forgot password?
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs muted">
        Need an account?{" "}
        <a className="text-[color:var(--accent)]" href="/signup">
          Create one
        </a>{" "}
        to unlock dashboards.
      </p>
    </form>
  );
}
```

(Removed: the `GoogleSignInButton` import and its render, and the `or` divider around it. Renamed `email` state to `identifier`, matching the shared client's new payload shape.)

- [ ] **Step 4: Manually verify in the browser**

Since this is a UI change, follow this repo's convention of checking the feature in a running dev server before considering the task done — start the backend and web dev servers (`pnpm dev:backend`, `pnpm dev:web`), open `/login`, and confirm: the Google button is gone, the email/phone field accepts both shapes, and a normal email+password login still reaches the 2FA screen (full phone-login and password-setup-required verification happens once the backend recovery/phone flows from Tasks 6 and 9 are live and there's a real account to test against — a smoke check that the page renders without errors is sufficient for this task alone).

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/components/google-signin-button.tsx apps/web/src/app/auth/callback apps/web/src/app/login/signin-form.tsx
git commit -m "feat(web): remove Google sign-in, identifier-based login form, OAuth-recovery redirect"
```

---

### Task 12: Web — signup form accepts email or phone

**Files:**
- Modify: `apps/web/src/app/signup/signup-form.tsx`

**Interfaces:**
- Consumes: `ForumoApiClient.auth.register()` (Task 2, `email` now optional).

- [ ] **Step 1: Update the signup form**

Replace `apps/web/src/app/signup/signup-form.tsx` in full:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../lib/api-client";

export function SignupForm() {
  const router = useRouter();
  const api = createApiClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Provide an email or a phone number.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.auth.register({
        name: form.name,
        password: form.password,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      // The backend sends an email verification link (email signups) or an
      // SMS verification code (phone-only signups). Route accordingly —
      // login is blocked until whichever one completes.
      if (form.email.trim()) {
        router.push(
          ("/verify-email?pending=true&email=" +
            encodeURIComponent(form.email)) as any,
        );
      } else {
        router.push(
          ("/verify-phone?pending=true&phone=" +
            encodeURIComponent(form.phone)) as any,
        );
      }
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      const genericMessage = err instanceof Error ? err.message : null;
      setError(
        apiErrorMessage ||
          genericMessage ||
          "Unable to create account. Try a different email or phone number.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 card card-pad">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="subtle">Full name</span>
          <input
            className="input-forumo"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="subtle">Phone</span>
          <input
            className="input-forumo"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+27821234567"
          />
        </label>
      </div>
      <label className="space-y-1 text-sm">
        <span className="subtle">Email</span>
        <input
          type="email"
          className="input-forumo"
          value={form.email}
          onChange={(event) => updateField("email", event.target.value)}
        />
      </label>
      <p className="text-xs muted">Provide at least one of email or phone.</p>
      <label className="space-y-1 text-sm">
        <span className="subtle">Password</span>
        <input
          type="password"
          className="input-forumo"
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-block bg-emerald-600 text-white hover:bg-emerald-700"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
```

(Removed `required` from the email input and the `GoogleSignInButton` import/render/divider. Added a client-side at-least-one check ahead of the request — the DTO-level `AtLeastOneIdentifierConstraint` from Task 4 is the real enforcement; this is just a faster user-facing error.)

A `/verify-phone` page displaying "check your phone for a code" and a form posting to `POST /auth/otp/verify` (purpose `PHONE_VERIFICATION`) is a reasonable follow-up mirroring the existing `/verify-email` page, but building that page is UI work outside this backend-focused plan's remaining scope — flagged here rather than silently dropped; add it as a fast-follow once this plan lands, using `/verify-email`'s existing page as the template.

- [ ] **Step 2: Manually verify in the browser**

With `pnpm dev:web` running, open `/signup`, confirm: no Google button, email is no longer marked required, submitting with only a phone number (once the backend from Tasks 4–6 is deployed) succeeds and redirects to `/verify-phone` (a 404 is expected until that page is built, per Step 1's note — confirm the redirect itself fires correctly, which is what this task is responsible for).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/signup/signup-form.tsx
git commit -m "feat(web): allow signup with email or phone"
```

---

### Task 13: Web — OAuth account recovery page

**Files:**
- Create: `apps/web/src/app/login/recover-account/page.tsx`
- Create: `apps/web/src/app/login/recover-account/recover-account-form.tsx`

**Interfaces:**
- Consumes: `ForumoApiClient.auth.recoverOAuthAccount.request(email)` / `.confirm({...})` (Task 2). Reads the recovery token/email from `apps/web/src/lib/recovery-store.ts` (an in-memory store, added by a Task 11 fix round — mirrors `2fa-store.ts`'s pattern of keeping a short-lived token out of the URL/browser history/server logs), NOT from `useSearchParams()`. Task 11's `signin-form.tsx` calls `setRecoveryToken(token, email)` before navigating here.

- [ ] **Step 1: Write the page**

Create `apps/web/src/app/login/recover-account/page.tsx`:

```tsx
import { RecoverAccountForm } from "./recover-account-form";

export default function RecoverAccountPage() {
  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="mb-2 text-xl font-semibold">Set a new password</h1>
      <p className="mb-6 text-sm muted">
        This account was created with Google sign-in, which is no longer
        available. Enter the code we sent to your email to set a password.
      </p>
      <RecoverAccountForm />
    </div>
  );
}
```

- [ ] **Step 2: Write the form**

Create `apps/web/src/app/login/recover-account/recover-account-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@forumo/shared";

import { createApiClient } from "../../../lib/api-client";
import { set2FaToken } from "../../../lib/2fa-store";
import { getRecoveryEmail } from "../../../lib/recovery-store";

export function RecoverAccountForm() {
  const router = useRouter();
  const email = getRecoveryEmail() ?? "";
  const api = createApiClient();

  const [step, setStep] = useState<"request" | "confirm">("request");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestCode() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.auth.recoverOAuthAccount.request(email);
      setStep("confirm");
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      setError(apiErrorMessage ?? "Unable to send a recovery code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.auth.recoverOAuthAccount.confirm({
        email,
        code,
        newPassword,
        phone: phone.trim() || undefined,
      });
      set2FaToken(result.twoFactorToken, "/app");
      router.push("/login/2fa?mode=setup" as any);
    } catch (err) {
      const apiErrorMessage = err instanceof ApiError ? err.message : null;
      setError(apiErrorMessage ?? "Invalid or expired code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "request") {
    return (
      <div className="space-y-4 card card-pad">
        <p className="text-sm">
          We'll email a code to <strong>{email}</strong>.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={isSubmitting || !email}
          onClick={handleRequestCode}
        >
          {isSubmitting ? "Sending…" : "Send recovery code"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-4 card card-pad">
      <label className="space-y-1 text-sm">
        <span className="subtle">Code</span>
        <input
          className="input-forumo"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={6}
          required
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="subtle">New password</span>
        <input
          type="password"
          className="input-forumo"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="subtle">Phone (optional)</span>
        <input
          className="input-forumo"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+27821234567"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Setting password…" : "Set password"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

Since `email` now comes from the in-memory `recovery-store.ts` (Step 2's change, following Task 11's fix), not a URL query param, direct navigation to `/login/recover-account` alone will show an empty `email` and a disabled "Send recovery code" button — that's the correct, intended behavior (mirrors `2fa-store.ts`'s same navigate-from-login-only design), not a bug to route around. Verify the real path instead: with `pnpm dev:web` and `pnpm dev:backend` running, and a test account seeded with `passwordHash: ""`, attempt a normal login for that account — the login form should redirect here via `setRecoveryToken()` + `router.push()`, with `email` already populated. Confirm the "Send recovery code" step renders correctly and that submitting calls the backend endpoint (check the network tab) without a client-side crash. Full end-to-end verification (receiving the code, completing the flow into 2FA setup) needs a seeded `passwordHash: ""` account — reasonable to defer to manual QA once Task 9's backend is live in a real environment rather than block this task on it.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/login/recover-account
git commit -m "feat(web): OAuth account recovery page (set password, route to 2FA setup)"
```

---

### Task 14: Fix the `User.email` nullability ripple outside the auth module

**Added after Task 1's review** (see the SDD ledger's ruling): making `email` nullable in Task 1 breaks `npx tsc --noEmit` in modules this plan otherwise never touches — `admin.service.ts`, `auction-end.processor.ts`, `escrow.service.ts` — plus two spots inside the auth module itself, already fixed by additions folded into Tasks 3 and 7. This task is dispatched immediately after Task 1, ahead of Task 2, since it only depends on Task 1's schema change and nothing else in this plan. Doing it this early — rather than letting it linger until some later cleanup — means every subsequent task's own "run `npx tsc --noEmit`, expect no errors" step is actually true, instead of silently tolerating a pile of pre-existing unrelated errors for 9+ tasks.

**Files:**
- Modify: `packages/shared/src/types.ts` (`adminUserSummarySchema.email`, `adminUserDetailSchema.email` → nullable)
- Modify: `apps/backend/src/modules/admin/admin.service.ts`
- Modify: `apps/backend/src/modules/auctions/processors/auction-end.processor.ts`
- Modify: `apps/backend/src/modules/escrow/escrow.service.ts`

**Interfaces:**
- Consumes: Task 1's nullable `User.email`.
- Produces: `npx tsc --noEmit` clean across the whole backend and `packages/shared`. Nothing later in this plan depends on anything new here — this is a compile-error sweep, not a feature.

- [ ] **Step 1: Confirm the current error set**

Run (from `apps/backend`):
```bash
npx tsc --noEmit
```
Expected: errors in `admin.service.ts`, `auction-end.processor.ts`, and `escrow.service.ts` (roughly a dozen combined), all `Argument of type 'string | null' is not assignable to parameter of type 'string'` or similar, tracing back to `User.email`. This is the authoritative list — treat the guidance below as the pattern to apply, and the compiler's own output as ground truth for exactly which lines need it. If the compiler shows errors in files not mentioned here, fix those too using the same reasoning (guard-or-widen), and list them in your report.

- [ ] **Step 2: Widen the two shared Admin schemas that require a non-null email**

In `packages/shared/src/types.ts`, two schemas type an admin-facing user summary/detail with `email: z.string().email()` (required) — these are populated directly from Prisma `User` rows via `admin.service.ts`, so they need the same nullable treatment `safeUserSchema` already got in Task 2 (if Task 2 has landed by the time you run this — if not, apply the same pattern independently here; the two changes don't depend on each other).

`adminUserSummarySchema` (used by `AdminKycSubmission.user`/`.reviewer`, `AdminListingModeration.seller`, `AdminDisputeSummary.openedBy`):
```ts
export const adminUserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  name: z.string().nullable().optional(),
});
```

`adminUserDetailSchema`:
```ts
export const adminUserDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  role: z.string(),
  accountStatus: accountStatusSchema,
  kycStatus: z.string(),
  listingsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
```

Rebuild the package (from `packages/shared`):
```bash
npx tsc -p tsconfig.json
```
Expected: no errors. This alone should resolve every `admin.service.ts` error that comes from assigning `submission.user.email`/`updated.reviewer.email`/etc. into one of these two schema-typed object literals — those call sites in `admin.service.ts` need no code change themselves.

- [ ] **Step 3: Guard the notification call sites that require a non-null email**

The remaining errors are genuine — code passing a possibly-null `user.email` into a `NotificationsService` method whose parameter is typed `string`. The fix in every case is the same shape: only send the notification when an email exists. Apply it at each site:

`apps/backend/src/modules/admin/admin.service.ts`, in `suspendUser()` (the call is currently unconditional, right after the `$transaction`):
```ts
    if (user.email) {
      await this.notifications.notifyAccountSuspended(
        user.email,
        user.name,
        reason,
        suspendedUntil,
      );
    }
```

In `unsuspendUser()`:
```ts
    if (user.email) {
      await this.notifications.notifyAccountUnsuspended(user.email, user.name);
    }
```

In `banUser()`:
```ts
    if (user.email) {
      await this.notifications.notifyAccountBanned(user.email, user.name, reason);
    }
```

In `liftExpiredSuspensions()`, the call is inside a `.map()` over a bulk list — filter rather than wrapping each call in an `if`:
```ts
    await Promise.all(
      expired
        .filter((u) => u.email)
        .map((u) => this.notifications.notifyAccountUnsuspended(u.email!, u.name)),
    );
```
(The non-null assertion here is safe — it's on the exact value the `.filter()` immediately above just checked, not a bare unchecked assumption.)

`apps/backend/src/modules/auctions/processors/auction-end.processor.ts`, in the block that notifies the auction winner and seller:
```ts
          if (winner?.email) {
            await this.notifications.notifyAuctionWon(
              winner.email,
              winner.name ?? "Winner",
              createdOrderId,
              auction.listing.title,
              auction.bids[0].amountCents,
              auction.currency,
            );
          }
          if (seller?.email) {
            await this.notifications.notifyAuctionSold(
              seller.email,
              seller.name ?? "Seller",
              createdOrderId,
              auction.listing.title,
              auction.bids[0].amountCents,
              auction.currency,
            );
          }
```
(Changes `if (winner)`/`if (seller)` to `if (winner?.email)`/`if (seller?.email)` — a winner/seller lacking an email now simply doesn't get this notification, same as any other phone-only-account gap this plan already accepts elsewhere.)

`apps/backend/src/modules/escrow/escrow.service.ts`, in the release-notification block:
```ts
    if (client === this.prisma) {
      const releaseOrder = await client.order.findUnique({
        where: { id: orderId },
        select: { seller: { select: { email: true, name: true } } },
      });
      if (releaseOrder?.seller?.email) {
        // Non-blocking notification — the write above is already durable, and
        // a notification failure must never fail the release.
        void this.notifications
          .notifyEscrowReleased(
            releaseOrder.seller.email,
            releaseOrder.seller.name ?? "Seller",
            orderId,
            escrow.amountCents,
            escrow.currency,
          )
          .catch(() => undefined);
      }
    }
```
(Changes `if (releaseOrder?.seller)` to `if (releaseOrder?.seller?.email)` — same reasoning.)

- [ ] **Step 4: Re-run the compiler and existing test suites**

```bash
cd apps/backend
npx tsc --noEmit
npx jest admin
npx jest auctions
npx jest escrow
```
Expected: `tsc --noEmit` fully clean, zero errors, anywhere. All three test suites still pass — this task changes control flow only for the null-email case, which none of the existing tests construct (every existing fixture has a real email), so no existing test's expected behavior should change. If any existing test *does* break, that test was relying on the notification firing unconditionally — investigate before assuming the test is simply wrong.

Widening `adminUserSummarySchema`/`adminUserDetailSchema` to nullable email is a type change consumers could theoretically be affected by. Check the two frontends that render these types:
```bash
cd ../../apps/admin && npx tsc --noEmit
cd ../web && npx tsc --noEmit
```
Expected: both clean. Rendering a possibly-`null` string inside JSX (`{user.email}`) doesn't itself cause a type error — `ReactNode` accepts `null` — so a break here would mean something more specific (e.g. a `.toLowerCase()` call directly on `user.email` without a guard) and needs its own small fix at that exact call site, following the same guard pattern as Step 3.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts apps/backend/src/modules/admin/admin.service.ts apps/backend/src/modules/auctions/processors/auction-end.processor.ts apps/backend/src/modules/escrow/escrow.service.ts
git commit -m "fix: guard email-only notifications and widen admin schemas for nullable User.email"
```

---

### Task 15: Enforce `class-validator` DTOs on `AuthController` (pre-existing gap, unrelated to identifiers)

**Added after Task 9's review.** While fixing Task 9's password-complexity finding, the implementer discovered — and the controller independently verified by reading `nestjs-zod`'s source — that this backend has exactly one global validation pipe (`app.useGlobalPipes(new ZodValidationPipe())` in `apps/backend/src/main.ts:84`). `ZodValidationPipe.transform()` returns the request body **unchanged, unvalidated** for any DTO that isn't a Zod DTO (`createZodDto(schema)`-based). The entire auth module uses plain `class-validator` decorators instead (`@IsEmail`, `@MinLength`, `@Matches`, the `AtLeastOneIdentifier` constraint from Task 4, and now `RecoverOAuthAccountConfirmDto` from Task 9) — this is itself a pre-existing violation of this backend's own documented convention (`apps/backend/CLAUDE.md`: "Never use plain `class-validator` decorators"). Since no `class-validator` `ValidationPipe` is registered anywhere, **every one of those decorators has been silently inert at the HTTP layer since before this plan started** — a `POST /auth/register` with a one-character password currently succeeds.

This predates every task in this plan and isn't scoped to identifiers/2FA/OAuth-removal — it's flagged here rather than silently left broken because this plan has spent nine tasks adding and relying on `class-validator` rules (`AtLeastOneIdentifier`, `LoginDto.identifier`'s shape, every password-complexity rule) that would otherwise ship non-functional.

**Files:**
- Modify: `apps/backend/src/modules/auth/auth.controller.ts`
- Test: `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts` (or a new focused test file — implementer's choice, per Step 2 below)

**Interfaces:**
- Consumes: nothing from other tasks. Produces: `AuthController`'s routes now actually reject invalid bodies per their DTOs' `class-validator` decorators. No other task depends on this directly, but it makes every DTO-level validation this plan already wrote (Tasks 4, 6, 9) real instead of decorative.

- [ ] **Step 1: Scope the fix to `AuthController` only, not a second global pipe**

A second **global** `class-validator` `ValidationPipe` was considered and rejected: it would run on every request across all 27 backend modules, a blast radius far beyond this plan's scope, for a gap that's currently confirmed only in the auth module. Instead, add a **controller-scoped** pipe via NestJS's `@UsePipes()` decorator at the class level on `AuthController` — it runs after the existing global `ZodValidationPipe` (global pipes run before controller-level ones), so Zod-DTO'd routes elsewhere are completely unaffected, and within `AuthController` itself, routes using a plain inline body type (e.g. `verifyEmail(@Body() body: { token: string })`) are also unaffected — NestJS's built-in `ValidationPipe` skips primitive/plain-`Object`-typed parameters automatically (no class metadata to validate against), it only activates for parameters typed as an actual class (i.e. every `class-validator`-decorated DTO this plan and its predecessors added).

In `apps/backend/src/modules/auth/auth.controller.ts`, add to the imports:
```ts
import { UsePipes, ValidationPipe } from "@nestjs/common";
```
(merge into the existing `@nestjs/common` import line rather than adding a second one, matching this file's existing style)

Add the decorator to the controller class, alongside the existing `@Controller("auth")` and `@SkipTosCheck()`:
```ts
@Controller("auth")
@SkipTosCheck()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AuthController {
```

`whitelist: true` strips any request-body properties not declared on the DTO (standard hardening, matches what a `ValidationPipe` is normally configured with elsewhere in the NestJS ecosystem); `transform: true` lets `class-transformer` construct a real DTO instance from the plain JSON body before validation runs (required for `class-validator` to see the decorators at all — without it, `validate()` receives a plain object with no attached metadata and silently reports zero errors regardless of input).

- [ ] **Step 2: Write a failing test proving the gap, then the fix**

Add to `apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts`, inside `describe("AuthModule HTTP flows", ...)`:

```ts
  it("rejects registration with a password that fails complexity requirements", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Zuri", email: "zuri@example.com", password: "short" })
      .expect(400);
  });

  it("rejects registration with neither email nor phone", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Zuri", password: "hunter2!Aa" })
      .expect(400);
  });
```

Run (from `apps/backend`):
```bash
npx jest auth.flows.spec.ts -t "rejects registration"
```
Expected: FAIL — both currently return 201 (or whatever the unvalidated path produces), not 400, since neither `RegisterDto`'s password-complexity `@Matches` nor the `AtLeastOneIdentifier` constraint currently run at the HTTP boundary. (The second test may already incidentally pass due to Task 5's service-layer defense-in-depth check for "neither identifier" — if so, that's fine and expected; the first test, password complexity, has no such backup anywhere and must fail before this task's fix.)

Apply Step 1's fix, then re-run:
```bash
npx jest auth.flows.spec.ts -t "rejects registration"
```
Expected: PASS, both tests, now genuinely enforced at the HTTP layer.

- [ ] **Step 3: Run the full auth suite and confirm no regression**

```bash
npx jest auth
npx tsc --noEmit
```
Expected: all auth tests still pass — in particular, every existing test in `auth.flows.spec.ts` that POSTs a *valid* body to any `AuthController` route must still succeed once `ValidationPipe` is active, since a `whitelist`/`transform`-enabled pipe can occasionally reject something that was previously silently accepted (e.g. an extra property in a test's request body, or a value in a shape the DTO's decorators don't quite expect). If any previously-passing test now fails, that's a genuine finding to investigate and fix — either the test's request body needs correcting to match the DTO, or the DTO's validation is stricter than intended and needs adjusting. Do not weaken `whitelist`/`transform` to make a failing test pass without first checking which one is actually wrong.

`npx tsc --noEmit` should remain fully clean (this task adds no new types, just decorator wiring).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/auth/auth.controller.ts apps/backend/src/modules/auth/__tests__/auth.flows.spec.ts
git commit -m "fix(auth): enforce class-validator DTOs on AuthController (were silently inert)"
```

## Plan Self-Review

**Spec coverage:**
- Spec §1 (data model) → Task 1.
- Spec §2 (email/phone signup+login, phone verification, channel fix) → Tasks 3, 4, 5, 6, 12.
- Spec §3 (2FA OTP fallback) → Task 8.
- Spec §4 (Google removal + OAuth recovery) → Tasks 9, 10, 11, 13.
- Spec §5 (TOTP lockout → Redis) → Task 7.
- Spec's "no new dependencies/env vars" constraint → enforced throughout (Task 10 only *removes* a dependency).

**Known gaps, explicitly flagged rather than silently dropped:**
- A `/verify-phone` page (Task 12, Step 1) — mirrors the existing `/verify-email` page but isn't built in this plan; noted as a fast-follow.
- The downstream `user.email` nullability ripple the spec itself flagged (audit logs, notifications, admin listings potentially assuming a non-null email) is not exhaustively swept by this plan — each of those call sites keeps working for email-primary users (the overwhelming majority in practice) and only needs attention for phone-only accounts, which is a reasonable place to stop for an initial implementation; revisit if phone-only signup sees real usage.
- End-to-end browser verification of the full phone-login and OAuth-recovery journeys is deferred to manual QA in Tasks 12–13, since it requires seeded data this plan's unit/integration tests don't set up in the running dev environment.

## Approval

Per `.assistant/rules/protected-paths.md` and the spec's own Approval section, do not run Task 1's migration against any shared database, and do not merge or deploy any part of this plan, without the Project Owner's explicit scoped approval.
