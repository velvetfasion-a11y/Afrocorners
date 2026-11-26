"use client";

import { useParams } from "next/navigation";
import { ProductForm } from "@/components/admin/screens";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ProductForm id={params.id} />;
}
