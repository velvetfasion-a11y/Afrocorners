import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { oauthStartUrl } from "@/lib/sumup/client";
import { adminFromRequest } from "@/lib/server/session";

export async function GET(req: Request) {
  const admin = await adminFromRequest(req);
  if (!admin) return NextResponse.redirect(new URL("/admin/login", req.url));
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/sumup/oauth/callback`;
  const state = randomBytes(16).toString("hex");
  try {
    const location = oauthStartUrl(redirectUri, state);
    const response = NextResponse.redirect(location);
    response.cookies.set("sumup_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/admin/sumup?fel=oauth", req.url));
  }
}
