import { json } from "@/lib/server/guard";
import { usingFirebase } from "@/lib/server/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const firebase = usingFirebase();
  return json({
    mode: firebase ? "firebase" : "demo",
    oauth: Boolean(process.env.SUMUP_CLIENT_ID && process.env.SUMUP_CLIENT_SECRET),
    demoEmail: firebase ? null : process.env.DEMO_ADMIN_EMAIL || "agare@afrocorner.se",
    demoPassword: firebase ? null : process.env.DEMO_ADMIN_PASSWORD || "demo1234",
    firebase: firebase
      ? {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        }
      : null,
  });
}
