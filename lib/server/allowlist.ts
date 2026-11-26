export type AdminRole = "owner" | "developer";

/** `email@example.com:developer, other@example.com:owner` */
export function parseAdminEmails(raw: string | undefined): Map<string, AdminRole> {
  const allowed = new Map<string, AdminRole>();
  if (!raw) return allowed;
  for (const part of raw.split(",")) {
    const [emailRaw, roleRaw] = part.split(":");
    const email = emailRaw?.trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const roleName = roleRaw?.trim().toLowerCase();
    if (roleName && roleName !== "owner" && roleName !== "developer") continue;
    allowed.set(email, roleName === "developer" ? "developer" : "owner");
  }
  return allowed;
}
