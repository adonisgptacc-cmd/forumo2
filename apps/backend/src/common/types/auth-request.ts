import type { UserRole } from '@prisma/client';

export interface AuthRequest {
  user: {
    id: string;
    role: UserRole;
    email?: string;
    name?: string;
  };
}
