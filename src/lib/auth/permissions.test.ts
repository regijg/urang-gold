import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_CODES,
  hasPermission,
  isEditablePermission,
  isRoleCode,
  normalizePermissions,
  sanitizeRolePermissions,
} from "./permissions";

describe("permissions helpers", () => {
  it("recognizes role codes", () => {
    expect(isRoleCode("OWNER")).toBe(true);
    expect(isRoleCode("owner")).toBe(false);
    expect(isRoleCode(undefined)).toBe(false);
  });

  it("drops unknown permission strings", () => {
    expect(normalizePermissions(["pos.use", "hack.all", "reports.view"])).toEqual(["pos.use", "reports.view"]);
    expect(normalizePermissions(null)).toEqual([]);
  });

  it("labels every permission exactly once in the settings matrix", () => {
    const listed = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
    expect([...listed].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("keeps owner-only and always-on permissions out of editable sets", () => {
    expect(isEditablePermission("users.manage")).toBe(false);
    expect(isEditablePermission("dashboard.view")).toBe(false);
    expect(isEditablePermission("sales.void")).toBe(true);
    expect(sanitizeRolePermissions(["sales.void", "users.manage", "hack", 1, "pos.use", "pos.use", "dashboard.view"])).toEqual(["pos.use", "sales.void"]);
  });

  it("checks granted permissions", () => {
    expect(hasPermission(["pos.use"], "pos.use")).toBe(true);
    expect(hasPermission(["pos.use"], "users.manage")).toBe(false);
  });
});

// Guards against the TS constants drifting from the seed in the migration.
describe("migration seed matches app constants", () => {
  const dir = join(process.cwd(), "supabase", "migrations");
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");

  it("seeds every role code", () => {
    for (const code of ROLE_CODES) expect(sql).toContain(`('${code}',`);
  });

  it("only seeds permissions the app knows", () => {
    const seedBlock = sql.slice(sql.indexOf("insert into public.gold_roles"), sql.indexOf("-- gold_tenants"));
    const seeded = new Set(seedBlock.match(/'[a-z_]+\.[a-z_]+'/g)?.map((s) => s.slice(1, -1)));
    expect(seeded.size).toBeGreaterThan(0);
    for (const p of seeded) expect(PERMISSIONS as readonly string[]).toContain(p);
  });

  it("gives OWNER every permission (seed or a later array_append migration)", () => {
    const ownerBlock = sql.slice(sql.indexOf("('OWNER'"), sql.indexOf("('ADMIN'"));
    const appended = [...sql.matchAll(/array_append\(permissions, '([a-z_.]+)'\)\s*where code in \(([^)]*)\)/g)]
      .filter((m) => m[2].includes("'OWNER'"))
      .map((m) => m[1]);
    for (const p of PERMISSIONS) expect(ownerBlock.includes(`'${p}'`) || appended.includes(p)).toBe(true);
  });

  it("does not let CASHIER manage users, stores or gold rates", () => {
    const cashierBlock = sql.slice(sql.indexOf("('CASHIER'"), sql.indexOf("('WAREHOUSE'"));
    for (const p of ["users.manage", "stores.manage", "gold_rates.manage", "reports.view"]) {
      expect(cashierBlock).not.toContain(`'${p}'`);
    }
  });
});
