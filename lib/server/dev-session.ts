import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { readCookie } from "./session";

const COOKIE = "afro_dev";

export function devSecret(): string {
  return process.env.DEV_ADMIN_SECRET?.trim() || "";
}

function sign(secret: string): string {
  return createHmac("sha256", secret).update("afrocorner-dev").digest("base64url");
}

export function devSetCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(sign(devSecret()))}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}${secure}`;
}

export function devClearCookie(): string {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function isDeveloper(req: Request): boolean {
  const secret = devSecret();
  if (!secret) return false;
  const given = readCookie(req, COOKIE);
  if (!given) return false;
  const expected = sign(secret);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
