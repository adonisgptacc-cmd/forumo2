import { User } from '@prisma/client';

export type SafeUser = Omit<
  User,
  'passwordHash' | 'emailVerificationToken' | 'twoFactorSecret' | 'twoFactorBackupCodes'
>;

type WithPassword = User & { passwordHash: string };

type SanitizableUser = SafeUser | WithPassword;

export const sanitizeUser = (user: SanitizableUser | null): SafeUser | null => {
  if (!user) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, emailVerificationToken, twoFactorSecret, twoFactorBackupCodes, ...rest } =
    user as User & { emailVerificationToken?: string };
  return rest as SafeUser;
};
