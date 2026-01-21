import { Role } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  institutionId: string | null;
  role: Role;
  email?: string | null;
  username?: string | null;
};
