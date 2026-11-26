import { Suspense } from "react";
import { SearchPage } from "@/components/site/pages";

export default function Page() {
  return (
    <Suspense fallback={<p className="wrap py-10">Söker…</p>}>
      <SearchPage />
    </Suspense>
  );
}
