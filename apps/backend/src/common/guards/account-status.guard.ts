import { ForbiddenException } from "@nestjs/common";
import { AccountStatus } from "@prisma/client";
import type { Request } from "express";

interface AccountCheckable {
  accountStatus: AccountStatus;
  suspensionReason: string | null;
  suspendedUntil: Date | null;
  banReason: string | null;
}

/**
 * Routes accessible even when accountStatus is PENDING_VERIFICATION.
 * All other authenticated routes are blocked until the user completes verification.
 */
const PENDING_VERIFICATION_ALLOWLIST: Array<{
  methods: string[];
  prefix: string;
}> = [
  { methods: ["GET", "POST"], prefix: "/api/v1/kyc" },
  { methods: ["GET"], prefix: "/api/v1/auth" },
  { methods: ["POST"], prefix: "/api/v1/auth/logout" },
];

export function isAllowedForPendingVerification(req: Request): boolean {
  const method = req.method.toUpperCase();
  const path = req.path;

  for (const rule of PENDING_VERIFICATION_ALLOWLIST) {
    if (rule.methods.includes(method) && path.startsWith(rule.prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Called from JwtStrategy.validate() after token verification succeeds.
 * Throws ForbiddenException for suspended, banned, or unverified accounts
 * that are hitting a restricted route.
 */
export function assertAccountActive(
  user: AccountCheckable,
  req: Request,
): void {
  switch (user.accountStatus) {
    case AccountStatus.SUSPENDED:
      throw new ForbiddenException({
        code: "ACCOUNT_SUSPENDED",
        reason: user.suspensionReason,
        until: user.suspendedUntil?.toISOString() ?? null,
      });

    case AccountStatus.BANNED:
      throw new ForbiddenException({
        code: "ACCOUNT_BANNED",
        reason: user.banReason,
      });

    case AccountStatus.PENDING_VERIFICATION:
      if (!isAllowedForPendingVerification(req)) {
        throw new ForbiddenException({ code: "VERIFICATION_REQUIRED" });
      }
      break;

    default:
      break;
  }
}
