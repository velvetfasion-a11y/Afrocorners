import "server-only";

import { NextResponse } from "next/server";
import { adminFromRequest, type SessionUser } from "./session";

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers });
}

export async function requireAdmin(req: Request): Promise<SessionUser | NextResponse> {
  const user = await adminFromRequest(req);
  if (!user) return json({ error: "Logga in igen." }, 401);
  return user;
}

export function isUser(value: SessionUser | NextResponse): value is SessionUser {
  return !(value instanceof NextResponse);
}

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
