import { readFileSync } from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createSeed } from "../lib/seed";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  || (process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8") : "");

if (!raw) {
  console.log("Ingen Firebase-nyckel. Butiken fylls automatiskt i demiläge första gången servern startar.");
  console.log("Sätt FIREBASE_SERVICE_ACCOUNT eller FIREBASE_SERVICE_ACCOUNT_PATH för att skriva exempeldata till Firestore.");
  process.exit(0);
}

const credentials = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: credentials.project_id,
    clientEmail: credentials.client_email,
    privateKey: credentials.private_key,
  }),
});
const db = getFirestore(app);
const seed = createSeed();
const batch = db.batch();
for (const product of seed.products) batch.set(db.collection("products").doc(product.id), product);
batch.set(db.doc("content/site"), seed.content);
batch.set(db.doc("meta/sumup"), seed.sumup);
await batch.commit();
console.log(`Skrev ${seed.products.length} produkter och butiksinnehållet till Firestore.`);
