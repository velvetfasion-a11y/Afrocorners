"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("agare@afrocorner.se");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"demo" | "firebase" | null>(null);
  const [hint, setHint] = useState("");
  const [firebaseConfig, setFirebaseConfig] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    fetch("/api/auth/mode").then((response) => response.json()).then((data) => {
      setMode(data.mode);
      setFirebaseConfig(data.firebase);
      if (data.demoEmail) setEmail(data.demoEmail);
      if (data.demoPassword) setHint(`${data.demoEmail} / ${data.demoPassword}`);
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "firebase" && firebaseConfig) {
        const { initializeApp, getApps } = await import("firebase/app");
        const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
        const app = getApps()[0] ?? initializeApp(firebaseConfig);
        const cred = await signInWithEmailAndPassword(getAuth(app), email, password);
        const idToken = await cred.user.getIdToken();
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
      } else {
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
      }
      router.replace("/admin");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Kunde inte logga in.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="font-display text-4xl">Afro<span className="italic text-gold">Corner</span></h1>
      <p className="mt-2 text-muted">Butikens admin. Bara ägaren loggar in.</p>
      <form className="mt-6 space-y-3" onSubmit={submit}>
        <Label>E-post<Input className="mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></Label>
        <Label>Lösenord<Input className="mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></Label>
        {error && <p className="text-sm text-red-800">{error}</p>}
        <Button type="submit" className="w-full">Logga in</Button>
      </form>
      {hint && <p className="mt-4 text-sm text-muted">Förhandsvisning utan Firebase: {hint}. Byt lösenord innan sidan läggs ut på nätet.</p>}
    </main>
  );
}
