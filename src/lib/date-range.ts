/**
 * Report date ranges in Asia/Jakarta (UTC+7, no DST). Returns ISO timestamps
 * [from, to) for the database plus the inclusive dates for display.
 */
export const RANGE_PRESETS = ["today", "7d", "30d", "month", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type DateRange = { preset: RangePreset; fromDate: string; toDate: string; fromIso: string; toIso: string; label: string };

const DAY = 24 * 60 * 60 * 1000;
const WIB_OFFSET = 7 * 60 * 60 * 1000;

function wibDate(d: Date): string {
  return new Date(d.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
}
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const startIso = (date: string) => new Date(Date.parse(`${date}T00:00:00+07:00`)).toISOString();

const LABELS: Record<RangePreset, string> = { today: "Hari ini", "7d": "7 hari", "30d": "30 hari", month: "Bulan ini", custom: "Rentang" };

export function resolveRange(params: { range?: string; from?: string; to?: string }, now = new Date()): DateRange {
  const today = wibDate(now);
  let preset: RangePreset = (RANGE_PRESETS as readonly string[]).includes(params.range ?? "") ? (params.range as RangePreset) : "today";
  let fromDate = today;
  let toDate = today;

  if (preset === "7d") fromDate = addDays(today, -6);
  else if (preset === "30d") fromDate = addDays(today, -29);
  else if (preset === "month") fromDate = `${today.slice(0, 8)}01`;
  else if (preset === "custom") {
    if (isDate(params.from) && isDate(params.to) && params.from <= params.to) {
      fromDate = params.from;
      toDate = params.to > today ? today : params.to;
      // cap at one year to keep queries cheap
      if (Date.parse(toDate) - Date.parse(fromDate) > 366 * DAY) fromDate = addDays(toDate, -366);
    } else {
      preset = "today";
    }
  }

  return { preset, fromDate, toDate, fromIso: startIso(fromDate), toIso: startIso(addDays(toDate, 1)), label: LABELS[preset] };
}

/** Today's calendar date in Asia/Jakarta ("2026-09-30"). */
export function todayWib(now = new Date()): string {
  return wibDate(now);
}
