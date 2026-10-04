import { ORDER_STATUS_LABELS, REPAIR_STATUS_LABELS } from "@/lib/validation/operations";

/** Labels shared by the report tabs and the CSV export. */
export const EXPENSE_STATUS_LABELS: Record<string, string> = { ACTIVE: "Aktif", VOIDED: "Dibatalkan" };
export const CASH_STATUS_LABELS: Record<string, string> = { OPEN: "Terbuka", CLOSED: "Ditutup" };
export const TRADE_IN_STATUS_LABELS: Record<string, string> = { COMPLETED: "Selesai", VOIDED: "Dibatalkan" };

export { ORDER_STATUS_LABELS, REPAIR_STATUS_LABELS };

/** "-1500" -> "Kurang", "1500" -> "Lebih", "0" -> "Cocok" (cash drawer difference). */
export function cashDifferenceLabel(difference: string | null): string {
  if (difference === null) return "";
  if (difference === "0") return "Cocok";
  return difference.startsWith("-") ? "Kurang" : "Lebih";
}
