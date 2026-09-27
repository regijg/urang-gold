import React from "react";
import { STATUS_LABELS, type PieceStatus } from "@/lib/validation/inventory";

const COLORS: Record<PieceStatus, string> = {
  AVAILABLE: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  SOLD: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
  BUYBACK: "bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-500",
  RESERVED: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
  REPAIR: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
  MELTED: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
  DAMAGED: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  LOST: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  VOIDED: "bg-gray-100 text-gray-500 line-through dark:bg-white/5 dark:text-gray-500",
};

export default function PieceStatusBadge({ status }: { status: PieceStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}
