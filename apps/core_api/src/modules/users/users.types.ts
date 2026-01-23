import type { Role } from '@prisma/client';

export type CurrentUser = {
  sub: string;
  institutionId?: string | null;
  role: Role;
  email?: string;
  username?: string;
};
