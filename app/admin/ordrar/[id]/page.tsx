"use client";

import { useParams } from "next/navigation";
import { OrderDetail } from "@/components/admin/screens";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <OrderDetail id={params.id} />;
}
