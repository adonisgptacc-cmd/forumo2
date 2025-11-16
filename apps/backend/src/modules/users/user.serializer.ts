import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

type WithPassword = User & { passwordHash: string };

type SanitizableUser = SafeUser | WithPassword;

export const sanitizeUser = (user: SanitizableUser | null): SafeUser | null => {
  if (!user) {
    return null;
  }

  if ('passwordHash' in user) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  return user;
};
