import { NextResponse } from "next/server";
import { exchangeCode, sumupMe, sumupMemberships } from "@/lib/sumup/client";
import { adminFromRequest } from "@/lib/server/session";
import { publicConnection, saveConnection, secretHint } from "@/lib/server/secrets";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const admin = await adminFromRequest(req);
  if (!admin) return NextResponse.redirect(new URL("/admin/login", req.url));
  const state = url.searchParams.get("state");
  const cookie = req.headers.get("cookie") ?? "";
  const saved = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("sumup_oauth_state="))?.split("=")[1];
  if (!state || !saved || decodeURIComponent(saved) !== state) {
    return NextResponse.redirect(new URL("/admin/sumup?fel=state", req.url));
  }
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/admin/sumup?fel=code", req.url));
  try {
    const tokens = await exchangeCode(code, `${url.origin}/api/sumup/oauth/callback`);
    const connection = {
      id: crypto.randomUUID(),
      authType: "oauth" as const,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.expiresAt,
      merchantCode: "",
      merchantName: "",
      extraMerchantCodes: [] as string[],
      keyHint: secretHint(tokens.refreshToken),
    };
    const me = await sumupMe(connection);
    connection.merchantCode = me.merchantCode;
    connection.merchantName = me.merchantName;
    const memberships = await sumupMemberships(connection);
    connection.extraMerchantCodes = memberships.filter((code) => code !== me.merchantCode);
    await saveConnection(connection);
    void publicConnection(connection);
    const response = NextResponse.redirect(new URL("/admin/sumup?kopplad=1", req.url));
    response.cookies.set("sumup_oauth_state", "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/admin/sumup?fel=token", req.url));
  }
}
