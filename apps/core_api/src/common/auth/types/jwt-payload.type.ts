import { Role } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  institutionId: string;
  role: Role;
  email?: string | null;
  username?: string | null;
};
