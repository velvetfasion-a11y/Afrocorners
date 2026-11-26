import { AdminShell } from "@/components/admin/shell";

export const metadata = { title: "AfroCorner admin" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
