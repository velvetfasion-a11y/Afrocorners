import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export interface SessionUser {
  uid: string;
  email: string;
  role: "owner" | "developer";
  /** google after both steps, demo only when Firebase is off */
  method: "google" | "demo";
  exp: number;
}

const COOKIE = "afro_session";

function secretFile() {
  return path.join(process.cwd(), ".data", "session-secret");
}

let cachedSecret: string | null = null;

async function secret(): Promise<string> {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  try {
    cachedSecret = (await readFile(secretFile(), "utf8")).trim();
    if (cachedSecret) return cachedSecret;
  } catch {
    /* create one */
  }
  cachedSecret = randomBytes(32).toString("hex");
  await mkdir(path.dirname(secretFile()), { recursive: true });
  await writeFile(secretFile(), cachedSecret, { mode: 0o600 });
  return cachedSecret;
}

export async function signSession(user: Omit<SessionUser, "exp">, hours = 8): Promise<string> {
  const payload: SessionUser = { ...user, exp: Date.now() + hours * 60 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", await secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export async function verifySession(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", await secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const user = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionUser;
    if (!user?.email || !user.role || !user.exp || user.exp < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name = COOKIE): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionSetCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 8}${secure}`;
}

export function sessionClearCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

export async function adminFromRequest(req: Request): Promise<SessionUser | null> {
  return verifySession(readCookie(req));
}

const attempts = new Map<string, { count: number; reset: number }>();

export function loginAllowed(ip: string): boolean {
  const now = Date.now();
  const row = attempts.get(ip);
  if (!row || row.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    return true;
  }
  row.count += 1;
  return row.count <= 8;
}
