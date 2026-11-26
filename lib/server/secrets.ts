import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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

export async function listConnections(): Promise<SumupConnection[]> {
  const remote = await firebaseSecrets();
  const stored = remote ? ((await remote.get()) ?? { connections: [] }) : await readFileSecrets();
  const connections = stored.connections.filter((item) => item.apiKey || item.refreshToken || item.accessToken);
  const envKey = process.env.SUMUP_API_KEY?.trim();
  if (envKey && !connections.some((item) => item.fromEnv || item.apiKey === envKey)) {
    connections.unshift({
      id: "env",
      authType: "api_key",
      apiKey: envKey,
      merchantCode: process.env.SUMUP_MERCHANT_CODE?.trim() || "",
      merchantName: "Miljövariabel",
      extraMerchantCodes: [],
      keyHint: hint(envKey),
      fromEnv: true,
    });
  }
  return connections;
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
