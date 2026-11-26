import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
const N = 16384;
const r = 8;
const p = 1;
const keyLen = 32;

export async function hashAccessCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const key = scryptSync(code, salt, keyLen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyAccessCode(code: string, stored: string | undefined): Promise<boolean> {
  if (!stored || !code.trim()) return false;
  const parts = stored.trim().split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const block = Number(parts[2]);
  const parallel = Number(parts[3]);
  if (!cost || !block || !parallel) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64url");
    expected = Buffer.from(parts[5], "base64url");
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 16) return false;
  const key = scryptSync(code, salt, expected.length, { N: cost, r: block, p: parallel });
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

export function accessCodeConfigured(): boolean {
  return Boolean(process.env.ADMIN_ACCESS_CODE_HASH?.trim());
}

type Bucket = { fails: number; lockUntil: number };
const buckets = new Map<string, Bucket>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function accessAttemptKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip}`;
}

export function lockoutMessage(key: string, now = Date.now()): string | null {
  const row = buckets.get(key);
  if (!row || row.lockUntil <= now) return null;
  const minutes = Math.max(1, Math.ceil((row.lockUntil - now) / 60000));
  return `För många försök. Försök igen om ${minutes} minuter.`;
}

export function recordAccessFailure(key: string, now = Date.now()): void {
  const row = buckets.get(key) ?? { fails: 0, lockUntil: 0 };
  if (row.lockUntil && row.lockUntil <= now) {
    row.fails = 0;
    row.lockUntil = 0;
  }
  row.fails += 1;
  if (row.fails >= MAX_FAILS) {
    row.lockUntil = now + LOCK_MS;
    row.fails = 0;
  }
  buckets.set(key, row);
}

export function clearAccessFailures(key: string): void {
  buckets.delete(key);
}
