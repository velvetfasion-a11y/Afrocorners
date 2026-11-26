import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { unitPrice } from "../format";
import { normalizeOffers, pickOffer, stockholmDate, type CustomerProfile, type ShopOffer } from "../offers";
import { applyOrderStock, commitMovement, reverseOrderStock, type CommitResult } from "../inventory";
import { createSeed } from "../seed";
import type { Database, Order, Product, SiteContent, StockLogEntry, StockMovementInput, StoreId, SumupState } from "../types";
import { firebaseAdminApp, usingFirebase } from "./firebase-admin";

const FILE = path.join(process.env.VERCEL ? path.join(tmpdir(), "afrocorner") : path.join(process.cwd(), ".data"), "db.json");

let chain: Promise<unknown> = Promise.resolve();

function queue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readFileDb(): Promise<Database> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as Database;
    if (!parsed.products || !parsed.content) throw new Error("empty");
    parsed.orders ??= [];
    parsed.logs ??= [];
    parsed.sumup ??= createSeed().sumup;
    parsed.offers = normalizeOffers(parsed.offers);
    parsed.customers ??= [];
    return parsed;
  } catch {
    const seed = createSeed();
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(seed), { mode: 0o600 });
    return seed;
  }
}

async function writeFileDb(db: Database) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(db), { mode: 0o600 });
}

function memoryPort(db: Database) {
  return {
    async getProduct(id: string) {
      return db.products.find((product) => product.id === id) ?? null;
    },
    async saveProduct(product: Product) {
      const index = db.products.findIndex((item) => item.id === product.id);
      if (index >= 0) db.products[index] = product;
      else db.products.push(product);
    },
    async findLogByExternalRef(ref: string) {
      return db.logs.find((entry) => entry.externalRef === ref) ?? null;
    },
    async addLog(entry: StockLogEntry) {
      db.logs.unshift(entry);
      db.logs = db.logs.slice(0, 500);
    },
  };
}

async function fileCommit(input: StockMovementInput): Promise<CommitResult> {
  return queue(async () => {
    const db = await readFileDb();
    const result = await commitMovement(memoryPort(db), input);
    await writeFileDb(db);
    return result;
  });
}

async function firestore() {
  const app = firebaseAdminApp();
  if (!app) throw new Error("Firebase Admin är inte konfigurerat.");
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(app);
}

async function ensureFirebaseSeed() {
  const db = await firestore();
  const [products, content] = await Promise.all([db.collection("products").limit(1).get(), db.doc("content/site").get()]);
  if (!products.empty || content.exists) return;
  const seed = createSeed();
  const batch = db.batch();
  for (const product of seed.products) batch.set(db.collection("products").doc(product.id), product);
  batch.set(db.doc("content/site"), seed.content);
  batch.set(db.doc("meta/sumup"), seed.sumup);
  await batch.commit();
}

async function firebaseCommit(input: StockMovementInput): Promise<CommitResult> {
  const db = await firestore();
  return db.runTransaction(async (tx) => {
    if (input.externalRef) {
      const existing = await tx.get(db.collection("stockLogs").where("externalRef", "==", input.externalRef).limit(1));
      if (!existing.empty) {
        return {
          applied: false,
          skippedDuplicate: true,
          appliedChange: 0,
          entry: existing.docs[0].data() as StockLogEntry,
        };
      }
    }
    const ref = db.collection("products").doc(input.productId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Produkten finns inte längre.");
    const product = snap.data() as Product;
    const port = {
      async getProduct() {
        return product;
      },
      async saveProduct(next: Product) {
        tx.update(ref, { stock: next.stock });
      },
      async findLogByExternalRef() {
        return null;
      },
      async addLog(entry: StockLogEntry) {
        tx.set(db.collection("stockLogs").doc(entry.id), entry);
      },
    };
    return commitMovement(port, input);
  });
}

export function dataMode(): "firebase" | "file" {
  return usingFirebase() ? "firebase" : "file";
}

export async function applyMovement(input: StockMovementInput): Promise<CommitResult> {
  return dataMode() === "firebase" ? firebaseCommit(input) : fileCommit(input);
}

export async function readDatabase(): Promise<Database> {
  if (dataMode() === "file") return readFileDb();
  await ensureFirebaseSeed();
  const db = await firestore();
  const [products, contentSnap, orders, logs, sumupSnap] = await Promise.all([
    db.collection("products").get(),
    db.doc("content/site").get(),
    db.collection("orders").get(),
    db.collection("stockLogs").orderBy("createdAt", "desc").limit(500).get(),
    db.doc("meta/sumup").get(),
  ]);
  const seed = createSeed();
  return {
    products: products.docs.map((doc) => doc.data() as Product),
    content: (contentSnap.data() as SiteContent) ?? seed.content,
    orders: orders.docs.map((doc) => doc.data() as Order).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    logs: logs.docs.map((doc) => doc.data() as StockLogEntry),
    sumup: (sumupSnap.data() as SumupState) ?? seed.sumup,
  };
}

export async function saveProduct(product: Product): Promise<void> {
  if (dataMode() === "file") {
    await queue(async () => {
      const db = await readFileDb();
      const index = db.products.findIndex((item) => item.id === product.id);
      if (index >= 0) db.products[index] = product;
      else db.products.push(product);
      await writeFileDb(db);
    });
    return;
  }
  const db = await firestore();
  await db.collection("products").doc(product.id).set(product);
}

export async function deleteProduct(id: string): Promise<void> {
  if (dataMode() === "file") {
    await queue(async () => {
      const db = await readFileDb();
      db.products = db.products.filter((product) => product.id !== id);
      await writeFileDb(db);
    });
    return;
  }
  const db = await firestore();
  await db.collection("products").doc(id).delete();
}

export async function saveContent(content: SiteContent): Promise<void> {
  if (dataMode() === "file") {
    await queue(async () => {
      const db = await readFileDb();
      db.content = content;
      await writeFileDb(db);
    });
    return;
  }
  const db = await firestore();
  await db.doc("content/site").set(content);
}

export async function saveOrder(order: Order): Promise<void> {
  if (dataMode() === "file") {
    await queue(async () => {
      const db = await readFileDb();
      const index = db.orders.findIndex((item) => item.id === order.id);
      if (index >= 0) db.orders[index] = order;
      else db.orders.unshift(order);
      await writeFileDb(db);
    });
    return;
  }
  const db = await firestore();
  await db.collection("orders").doc(order.id).set(order);
}

export async function saveSumupState(sumup: SumupState): Promise<void> {
  if (dataMode() === "file") {
    await queue(async () => {
      const db = await readFileDb();
      db.sumup = sumup;
      await writeFileDb(db);
    });
    return;
  }
  const db = await firestore();
  await db.doc("meta/sumup").set(sumup);
}

export async function createPricedOrder(input: {
  items: { productId: string; qty: number }[];
  fulfilment: Order["fulfilment"];
  pickupStoreId: StoreId | null;
  customer: Order["customer"];
  number: string;
  customerUid?: string | null;
  account?: CustomerProfile | null;
  offers?: ShopOffer[];
}): Promise<Order> {
  const db = await readDatabase();
  const items: Order["items"] = [];
  for (const line of input.items) {
    const qty = Math.round(line.qty);
    if (qty < 1 || qty > 99) throw new Error("Antalet måste vara mellan 1 och 99.");
    const product = db.products.find((item) => item.id === line.productId && item.active);
    if (!product) throw new Error("En vara finns inte längre.");
    items.push({
      productId: product.id,
      name: product.name,
      qty,
      unitPrice: unitPrice(product),
      image: product.images[0] ?? "",
    });
  }
  if (items.length === 0) throw new Error("Varukorgen är tom.");
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const applied = input.account ? pickOffer(input.offers ?? [], input.account, subtotal, stockholmDate()) : null;
  const discount = Math.min(subtotal, Math.max(0, applied?.discount ?? 0));
  const order: Order = {
    id: crypto.randomUUID(),
    number: input.number,
    createdAt: new Date().toISOString(),
    status: "ny",
    fulfilment: input.fulfilment,
    pickupStoreId: input.fulfilment === "pickup" ? input.pickupStoreId : null,
    shipFromStoreId: null,
    customer: input.customer,
    items,
    subtotal,
    total: subtotal - discount,
    customerUid: input.customerUid ?? null,
    discount: applied && discount > 0
      ? { offerId: applied.offerId, title: applied.title, amount: discount }
      : null,
    stockApplied: false,
    stockGeneration: 0,
    stockDeductions: [],
    note: "",
  };
  await saveOrder(order);
  return order;
}

export async function readOffers(): Promise<ShopOffer[]> {
  if (dataMode() === "file") {
    const db = await readFileDb();
    return normalizeOffers(db.offers);
  }
  const db = await firestore();
  const snap = await db.collection("offers").get();
  const stored = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ShopOffer);
  return normalizeOffers(stored);
}

export async function writeOffers(offers: ShopOffer[]): Promise<ShopOffer[]> {
  const next = normalizeOffers(offers);
  if (dataMode() === "file") {
    await queue(async () => {
      const db = await readFileDb();
      db.offers = next;
      await writeFileDb(db);
    });
    return next;
  }
  const db = await firestore();
  const batch = db.batch();
  for (const offer of next) batch.set(db.collection("offers").doc(offer.id), offer);
  await batch.commit();
  return next;
}

export async function readCustomer(uid: string): Promise<CustomerProfile | null> {
  if (dataMode() === "file") {
    const db = await readFileDb();
    return db.customers?.find((item) => item.uid === uid) ?? null;
  }
  const db = await firestore();
  const snap = await db.collection("customers").doc(uid).get();
  return snap.exists ? (snap.data() as CustomerProfile) : null;
}

export async function writeCustomer(profile: CustomerProfile): Promise<void> {
  if (dataMode() === "file") {
    await queue(async () => {
      const db = await readFileDb();
      const customers = db.customers ?? [];
      const index = customers.findIndex((item) => item.uid === profile.uid);
      if (index >= 0) customers[index] = profile;
      else customers.push(profile);
      db.customers = customers;
      await writeFileDb(db);
    });
    return;
  }
  const db = await firestore();
  await db.collection("customers").doc(profile.uid).set(profile, { merge: true });
}

export async function ordersForCustomer(uid: string): Promise<Order[]> {
  if (dataMode() === "file") {
    const db = await readFileDb();
    return db.orders.filter((order) => order.customerUid === uid);
  }
  const db = await firestore();
  const snap = await db.collection("orders").where("customerUid", "==", uid).get();
  return snap.docs
    .map((doc) => doc.data() as Order)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Counts the order after eligibility was decided, so the first order still qualifies. */
export async function recordCustomerOrder(uid: string, when = new Date().toISOString()): Promise<void> {
  if (dataMode() === "file") {
    await queue(async () => {
      const db = await readFileDb();
      const customers = db.customers ?? [];
      const index = customers.findIndex((item) => item.uid === uid);
      if (index < 0) return;
      const current = customers[index];
      customers[index] = {
        ...current,
        orderCount: (current.orderCount ?? 0) + 1,
        firstOrderAt: current.firstOrderAt ?? when,
      };
      db.customers = customers;
      await writeFileDb(db);
    });
    return;
  }
  const db = await firestore();
  const ref = db.collection("customers").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as CustomerProfile | undefined;
    tx.set(ref, {
      orderCount: (current?.orderCount ?? 0) + 1,
      firstOrderAt: current?.firstOrderAt ?? when,
    }, { merge: true });
  });
}

export async function transitionOrder(orderId: string, status: Order["status"], shipFrom: StoreId): Promise<Order> {
  const db = await readDatabase();
  const current = db.orders.find((order) => order.id === orderId);
  if (!current) throw new Error("Ordern finns inte.");
  let next = current;
  if (status === "klar" && !current.stockApplied) {
    next = await applyOrderStock((input) => applyMovement(input), current, shipFrom);
  } else if (current.status === "klar" && status !== "klar") {
    next = await reverseOrderStock((input) => applyMovement(input), current, status);
  } else {
    next = { ...current, status };
  }
  await saveOrder(next);
  return next;
}

export async function replaceWithSeed(): Promise<void> {
  const seed = createSeed();
  if (dataMode() === "file") {
    await writeFileDb(seed);
    return;
  }
  const db = await firestore();
  const existing = await db.collection("products").get();
  const batch = db.batch();
  for (const doc of existing.docs) batch.delete(doc.ref);
  for (const product of seed.products) batch.set(db.collection("products").doc(product.id), product);
  batch.set(db.doc("content/site"), seed.content);
  batch.set(db.doc("meta/sumup"), seed.sumup);
  await batch.commit();
}
