import { readFileSync } from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { Product } from "../lib/types";
import { planVariantMerges } from "../lib/variants";

const apply = process.argv.includes("--apply");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  || (process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8") : "");

if (!raw) {
  console.error("Sätt FIREBASE_SERVICE_ACCOUNT eller FIREBASE_SERVICE_ACCOUNT_PATH. Skriptet skriver inte utan en service account.");
  process.exit(1);
}

const credentials = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: credentials.project_id,
    clientEmail: credentials.client_email,
    privateKey: credentials.private_key,
  }),
});
const db: Firestore = getFirestore(app);
const snap = await db.collection("products").get();
const products = snap.docs.map((doc) => ({ ...(doc.data() as Product), id: doc.id }));
const plans = planVariantMerges(products);

if (plans.length === 0) {
  console.log("Inga delade storlekar att slå ihop.");
  process.exit(0);
}

for (const plan of plans) {
  const labels = (plan.survivor.variants ?? []).map((variant) => `${variant.label} ${variant.price} kr`).join(", ");
  console.log(`${plan.survivor.id} → ${plan.survivor.name}: ${labels}`);
  console.log(`  tar bort ${plan.retireIds.join(", ")}`);
}

console.log(`${plans.length} produkter slås ihop.`);
if (!apply) {
  console.log("Torrkörning. Kör igen med --apply för att skriva till Firestore.");
  process.exit(0);
}

let batch = db.batch();
let writes = 0;
async function flush(force = false) {
  if (writes === 0 || (!force && writes < 400)) return;
  await batch.commit();
  batch = db.batch();
  writes = 0;
}
for (const plan of plans) {
  batch.set(db.collection("products").doc(plan.survivor.id), plan.survivor);
  writes += 1;
  for (const id of plan.retireIds) {
    batch.delete(db.collection("products").doc(id));
    writes += 1;
    await flush();
  }
  await flush();
}
await flush(true);
console.log("Klart.");
