import { User } from "@prisma/client";

export type SafeUser = Omit<
  User,
  | "passwordHash"
  | "emailVerificationToken"
  | "twoFactorSecret"
  | "twoFactorBackupCodes"
>;

type WithPassword = User & { passwordHash: string };

type SanitizableUser = SafeUser | WithPassword;

export const sanitizeUser = (user: SanitizableUser | null): SafeUser | null => {
  if (!user) {
    return null;
  }

  const {
    passwordHash: _passwordHash,
    emailVerificationToken: _emailVerificationToken,
    twoFactorSecret: _twoFactorSecret,
    twoFactorBackupCodes: _twoFactorBackupCodes,
    ...rest
  } = user as User & { emailVerificationToken?: string };
  return rest as SafeUser;
};
