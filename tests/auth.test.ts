import { describe, expect, it } from "vitest";
import { parseAdminEmails } from "../lib/server/allowlist";
import { clearAccessFailures, hashAccessCode, lockoutMessage, recordAccessFailure, verifyAccessCode, accessAttemptKey } from "../lib/server/access-code";

describe("admin allowlist", () => {
  it("läser e-post och roll, och hoppar över okända roller", () => {
    const list = parseAdminEmails(" Julia@Example.com:developer , agare@shop.se:owner , fel, nope@shop.se:guest ");
    expect(list.get("julia@example.com")).toBe("developer");
    expect(list.get("agare@shop.se")).toBe("owner");
    expect(list.has("nope@shop.se")).toBe(false);
    expect(list.size).toBe(2);
  });
});

describe("åtkomstkod", () => {
  it("godkänner bara rätt kod mot hashet", async () => {
    const hash = await hashAccessCode("en-hemlig-kod");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("en-hemlig-kod");
    expect(await verifyAccessCode("en-hemlig-kod", hash)).toBe(true);
    expect(await verifyAccessCode("fel", hash)).toBe(false);
    expect(await verifyAccessCode("", hash)).toBe(false);
  });

  it("låser efter fem fel", () => {
    const key = accessAttemptKey("julia@example.com", "203.0.113.5");
    clearAccessFailures(key);
    for (let i = 0; i < 4; i += 1) recordAccessFailure(key, 1_000);
    expect(lockoutMessage(key, 1_000)).toBeNull();
    recordAccessFailure(key, 1_000);
    expect(lockoutMessage(key, 1_000)).toMatch(/För många försök/);
    clearAccessFailures(key);
  });
});
