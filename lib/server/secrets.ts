import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { StoreId } from "../types";

export interface SumupConnection {
  id: string;
  authType: "api_key" | "oauth";
  apiKey?: string;
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
  merchantCode: string;
  merchantName: string;
  extraMerchantCodes: string[];
  keyHint: string;
  fromEnv?: boolean;
  /** Which shop this SumUp account's sales belong to. Set from env, not the owner UI. */
  storeId?: StoreId;
}

interface SecretFile {
  connections: SumupConnection[];
}

function filePath() {
  return path.join(process.cwd(), ".data", "sumup-secrets.json");
}

async function readFileSecrets(): Promise<SecretFile> {
  try {
    const parsed = JSON.parse(await readFile(filePath(), "utf8")) as SecretFile;
    return { connections: parsed.connections ?? [] };
  } catch {
    return { connections: [] };
  }
}

async function writeFileSecrets(data: SecretFile) {
  await mkdir(path.dirname(filePath()), { recursive: true });
  await writeFile(filePath(), JSON.stringify(data), { mode: 0o600 });
}

function hint(secret: string): string {
  const tail = secret.replace(/\s/g, "").slice(-4);
  return tail ? `••••${tail}` : "••••";
}

export function publicConnection(connection: SumupConnection) {
  return {
    id: connection.id,
    authType: connection.authType,
    merchantCode: connection.merchantCode,
    merchantName: connection.merchantName,
    extraMerchantCodes: connection.extraMerchantCodes,
    keyHint: connection.keyHint,
    fromEnv: Boolean(connection.fromEnv),
  };
}

async function firebaseSecrets(): Promise<{ get: () => Promise<SecretFile | null>; set: (data: SecretFile) => Promise<void> } | null> {
  const { firebaseAdminApp } = await import("./firebase-admin");
  const app = firebaseAdminApp();
  if (!app) return null;
  const { getFirestore } = await import("firebase-admin/firestore");
  const ref = getFirestore(app).doc("private/sumup");
  return {
    async get() {
      const snap = await ref.get();
      if (!snap.exists) return null;
      const data = snap.data() as SecretFile;
      return { connections: data.connections ?? [] };
    },
    async set(data) {
      await ref.set(data);
    },
  };
}

function envConnection(storeId: StoreId, apiKey: string | undefined, merchantCode: string | undefined): SumupConnection | null {
  const key = apiKey?.trim();
  if (!key) return null;
  return {
    id: `env-${storeId}`,
    authType: "api_key",
    apiKey: key,
    merchantCode: merchantCode?.trim() || "",
    merchantName: storeId === "fittja" ? "Fittja" : "Märsta",
    extraMerchantCodes: [],
    keyHint: hint(key),
    fromEnv: true,
    storeId,
  };
}

/** SumUp accounts come only from server env. The owner never enters a key. */
export function connectionsFromEnv(): SumupConnection[] {
  const perStore = [
    envConnection("fittja", process.env.SUMUP_FITTJA_API_KEY, process.env.SUMUP_FITTJA_MERCHANT_CODE),
    envConnection("marsta", process.env.SUMUP_MARSTA_API_KEY, process.env.SUMUP_MARSTA_MERCHANT_CODE),
  ].filter((item): item is SumupConnection => Boolean(item));
  if (perStore.length > 0) return perStore;
  const singleStore: StoreId = process.env.SUMUP_STORE_ID === "marsta" ? "marsta" : "fittja";
  const single = envConnection(singleStore, process.env.SUMUP_API_KEY, process.env.SUMUP_MERCHANT_CODE);
  return single ? [single] : [];
}

export async function listConnections(): Promise<SumupConnection[]> {
  return connectionsFromEnv();
}

export async function saveConnection(connection: SumupConnection): Promise<void> {
  if (connection.fromEnv) return;
  const remote = await firebaseSecrets();
  const current = remote ? ((await remote.get()) ?? { connections: [] }) : await readFileSecrets();
  const next = current.connections.filter((item) => item.id !== connection.id && !item.fromEnv);
  next.push({ ...connection, fromEnv: false, keyHint: connection.keyHint || hint(connection.apiKey || connection.refreshToken || "") });
  if (remote) await remote.set({ connections: next });
  else await writeFileSecrets({ connections: next });
}

export async function removeConnection(id: string): Promise<void> {
  if (id === "env") return;
  const remote = await firebaseSecrets();
  const current = remote ? ((await remote.get()) ?? { connections: [] }) : await readFileSecrets();
  const next = { connections: current.connections.filter((item) => item.id !== id) };
  if (remote) await remote.set(next);
  else await writeFileSecrets(next);
}

export { hint as secretHint };
