"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin"); }, [router]);
  return <p className="text-muted">Kassan sätts upp av den som bygger sidan.</p>;
}
