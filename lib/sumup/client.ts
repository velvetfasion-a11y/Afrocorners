import "server-only";

import type { SumupConnection } from "../server/secrets";
import { saveConnection } from "../server/secrets";
import type { SaleRecord, TransactionRecord } from "./parse";

const API = "https://api.sumup.com";
const USER_AGENT = "AfroCorner/1.0 (stock-sync)";

export class SumUpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function raw(connection: SumupConnection, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(connection);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("User-Agent", USER_AGENT);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
}

async function accessToken(connection: SumupConnection): Promise<string> {
  if (connection.authType === "api_key") {
    if (!connection.apiKey) throw new SumUpError("API-nyckeln saknas.", 401);
    return connection.apiKey;
  }
  if (connection.accessToken && (connection.accessTokenExpiresAt ?? 0) > Date.now() + 30_000) {
    return connection.accessToken;
  }
  if (!connection.refreshToken) throw new SumUpError("OAuth-token saknas. Koppla SumUp igen.", 401);
  const clientId = process.env.SUMUP_CLIENT_ID;
  const clientSecret = process.env.SUMUP_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new SumUpError("SUMUP_CLIENT_ID och SUMUP_CLIENT_SECRET saknas på servern.", 500);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch(`${API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new SumUpError("Kunde inte förnya SumUp-token.", response.status);
  const json = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  connection.accessToken = json.access_token;
  if (json.refresh_token) connection.refreshToken = json.refresh_token;
  connection.accessTokenExpiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  if (!connection.fromEnv) await saveConnection(connection);
  return connection.accessToken;
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 280);
    } catch {
      detail = "";
    }
    throw new SumUpError(detail || `SumUp svarade ${response.status}.`, response.status);
  }
  return (await response.json()) as T;
}

export async function sumupMe(connection: SumupConnection): Promise<{ merchantCode: string; merchantName: string }> {
  const response = await raw(connection, "/v0.1/me");
  const json = await parse<Record<string, unknown>>(response);
  const profile = (json.merchant_profile ?? {}) as Record<string, unknown>;
  const merchantCode = String(profile.merchant_code || json.merchant_code || "");
  const merchantName = String(profile.company_name || profile.legal_name || merchantCode);
  if (!merchantCode) throw new SumUpError("SumUp-svaret saknade merchant code.", 502);
  return { merchantCode, merchantName };
}

export async function sumupMemberships(connection: SumupConnection): Promise<string[]> {
  const response = await raw(connection, "/v0.1/memberships");
  if (!response.ok) return [];
  const json = (await response.json()) as { items?: Record<string, unknown>[] } | Record<string, unknown>[];
  const items = Array.isArray(json) ? json : (json.items ?? []);
  return items
    .map((item) => String(item.merchant_code || (item.merchant as { merchant_code?: string } | undefined)?.merchant_code || ""))
    .filter(Boolean);
}

export interface ReaderInfo {
  id: string;
  name: string;
  device: string;
  status: string;
}

export async function sumupReaders(connection: SumupConnection, merchantCode: string): Promise<ReaderInfo[]> {
  const response = await raw(connection, `/v0.1/merchants/${encodeURIComponent(merchantCode)}/readers`);
  if (response.status === 403 || response.status === 404) return [];
  const json = await parse<{ items?: { id: string; name?: string; status?: string; device?: { identifier?: string; model?: string } }[] }>(response);
  return (json.items ?? []).map((reader) => ({
    id: reader.id,
    name: reader.name || reader.device?.identifier || reader.id,
    device: reader.device?.identifier || "",
    status: reader.status || "",
  }));
}

export async function searchSales(connection: SumupConnection, merchantCode: string, start: string, channels: string[], token?: string): Promise<{ ids: string[]; next?: string }> {
  const response = await raw(connection, `/v1.0/merchants/${encodeURIComponent(merchantCode)}/sales/search`, {
    method: "POST",
    body: JSON.stringify({
      start_date: start,
      sales_channels: channels,
      sale_statuses: ["CLOSED"],
      pagination_limit: 25,
      ...(token ? { pagination_token: token } : {}),
    }),
  });
  const json = await parse<{ items?: { id: string }[]; pagination_token?: string }>(response);
  return { ids: (json.items ?? []).map((item) => item.id), next: json.pagination_token };
}

export async function getSale(connection: SumupConnection, merchantCode: string, saleId: string): Promise<SaleRecord> {
  const response = await raw(connection, `/v1.0/merchants/${encodeURIComponent(merchantCode)}/sales/${encodeURIComponent(saleId)}`);
  return parse<SaleRecord>(response);
}

export async function listTransactions(connection: SumupConnection, merchantCode: string, changesSince: string): Promise<TransactionRecord[]> {
  const params = new URLSearchParams({
    changes_since: changesSince,
    limit: "100",
    order: "ascending",
  });
  params.append("statuses[]", "SUCCESSFUL");
  params.append("statuses[]", "REFUNDED");
  params.append("types[]", "PAYMENT");
  params.append("types[]", "REFUND");
  const response = await raw(connection, `/v2.1/merchants/${encodeURIComponent(merchantCode)}/transactions/history?${params.toString()}`);
  const json = await parse<{ items?: TransactionRecord[] }>(response);
  return json.items ?? [];
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const clientId = process.env.SUMUP_CLIENT_ID;
  const clientSecret = process.env.SUMUP_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new SumUpError("OAuth är inte konfigurerat på servern.", 500);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  const response = await fetch(`${API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new SumUpError("SumUp godkände inte inloggningen.", response.status);
  const json = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  if (!json.refresh_token) throw new SumUpError("SumUp skickade ingen refresh token.", 502);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export function oauthStartUrl(redirectUri: string, state: string): string {
  const clientId = process.env.SUMUP_CLIENT_ID;
  if (!clientId) throw new SumUpError("SUMUP_CLIENT_ID saknas.", 500);
  const url = new URL(`${API}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "sales.read transactions.history readers.read user.profile");
  return url.toString();
}
