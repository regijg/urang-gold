export const TENANT_PLANS = ["FREE", "STARTER", "PRO"] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

/** CLOSED exists in the database but is not offered in the console: suspending is reversible. */
export const TENANT_STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const PLAN_LABELS: Record<TenantPlan, string> = { FREE: "Gratis", STARTER: "Starter", PRO: "Pro" };
export const STATUS_LABELS: Record<TenantStatus, string> = { ACTIVE: "Aktif", SUSPENDED: "Ditangguhkan", CLOSED: "Ditutup" };

export const isTenantPlan = (v: unknown): v is TenantPlan => typeof v === "string" && (TENANT_PLANS as readonly string[]).includes(v);
export const isSwitchableStatus = (v: unknown): v is "ACTIVE" | "SUSPENDED" => v === "ACTIVE" || v === "SUSPENDED";
