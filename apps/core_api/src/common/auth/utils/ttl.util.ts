export function ttlToMs(ttl: string): number {
  // "15m" | "30d" | "12h" | "60s"
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`Invalid TTL: ${ttl}`);

  const n = Number(m[1]);
  const unit = m[2];

  const mult =
    unit === 's' ? 1000 :
    unit === 'm' ? 60_000 :
    unit === 'h' ? 3_600_000 :
    86_400_000;

  return n * mult;
}
