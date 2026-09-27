import { formatDateTime, formatGram, formatRupiah } from "./format";
import { PAYMENT_LABELS } from "./payments";

/** wa.me link; Indonesian local numbers (08...) are converted to 628... */
export function waLink(phone: string | null | undefined, text: string): string {
  const to = phone ? phone.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^0/, "62") : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export type ReceiptMessage = {
  storeName: string;
  invoiceNumber: string;
  date?: Date;
  customerName?: string | null;
  items: { name: string; purity: string; weight: string; price: string; discount?: string }[];
  discountTotal?: string;
  total: string;
  payments?: { method: string; amount: string }[];
  change?: string;
  url: string;
};

const positive = (v?: string) => !!v && BigInt(v.replace(/\D/g, "") || "0") > BigInt(0);

/**
 * Receipt text for WhatsApp (uses WhatsApp *bold* markup). Money values are
 * integer-rupiah strings.
 */
export function buildReceiptMessage(m: ReceiptMessage): string {
  const lines: string[] = [];
  lines.push(`*${m.storeName}*`);
  lines.push(`Nota: ${m.invoiceNumber}`);
  lines.push(`Tanggal: ${formatDateTime(m.date ?? new Date())}`);
  if (m.customerName) lines.push(`Customer: ${m.customerName}`);
  lines.push("");
  for (const i of m.items) {
    lines.push(`• ${i.name} (${i.purity}, ${formatGram(i.weight)})`);
    lines.push(`   ${formatRupiah(i.price)}${positive(i.discount) ? `  (diskon ${formatRupiah(i.discount)})` : ""}`);
  }
  lines.push("");
  if (positive(m.discountTotal)) lines.push(`Diskon: ${formatRupiah(m.discountTotal)}`);
  lines.push(`*Total: ${formatRupiah(m.total)}*`);
  for (const p of m.payments ?? []) {
    if (positive(p.amount)) lines.push(`${PAYMENT_LABELS[p.method] ?? p.method}: ${formatRupiah(p.amount)}`);
  }
  if (positive(m.change)) lines.push(`Kembalian: ${formatRupiah(m.change)}`);
  lines.push("");
  lines.push("Lihat nota lengkap:");
  lines.push(m.url);
  lines.push("");
  lines.push("Terima kasih telah berbelanja 🙏");
  return lines.join("\n");
}
