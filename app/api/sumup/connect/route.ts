import { json } from "@/lib/server/guard";

export function POST() {
  return json({ error: "SumUp sätts upp med miljövariabler, inte i admin." }, 404);
}

export function DELETE() {
  return json({ error: "SumUp sätts upp med miljövariabler, inte i admin." }, 404);
}
