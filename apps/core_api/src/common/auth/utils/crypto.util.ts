import * as bcrypt from 'bcrypt';

export async function hashValue(value: string): Promise<string> {
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  return bcrypt.hash(value, rounds);
}

export async function compareHash(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}
