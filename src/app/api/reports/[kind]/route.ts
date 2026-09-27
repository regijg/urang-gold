import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/action-result";
import { toCsv } from "@/lib/csv";
import { resolveRange } from "@/lib/date-range";
import { PAYMENT_LABELS } from "@/lib/payments";
import { dbRupiah } from "@/lib/validation/common";
import { MOVEMENT_LABELS } from "@/lib/validation/inventory";
import { reportService } from "@/server/services/report.service";

type Row = Record<string, unknown>;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Row | undefined;
const money = (v: unknown) => dbRupiah(v as string);

async function build(kind: string, sp: URLSearchParams): Promise<{ headers: string[]; rows: (string | number | null)[][] } | null> {
  const range = resolveRange({ range: sp.get("range") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const store = sp.get("store") ?? undefined;
  switch (kind) {
    case "daily": {
      const rows = await reportService.daily(range, store);
      return { headers: ["Tanggal", "Penjualan", "Jumlah transaksi", "Emas terjual (g)", "Buyback", "Emas dibeli (g)", "Pembelian"], rows: rows.map((r) => [r.day, r.sales_total, r.sales_count, r.gold_sold, r.buyback_total, r.gold_bought, r.purchase_total]) };
    }
    case "payments": {
      const rows = await reportService.payments(range, store);
      return { headers: ["Metode", "Masuk", "Keluar", "Bersih", "Jumlah"], rows: rows.map((r) => [PAYMENT_LABELS[r.method] ?? r.method, r.amount_in, r.amount_out, r.net, r.tx_count]) };
    }
    case "inventory": {
      const rows = await reportService.inventory(store);
      return { headers: ["Kadar", "Kategori", "Jumlah", "Berat emas (g)", "Nilai modal", "Nilai jual"], rows: rows.map((r) => [r.purity_code, r.category_name, r.item_count, r.gold_weight, r.cost_value, r.market_value]) };
    }
    case "customers": {
      const rows = await reportService.customers(range);
      return { headers: ["Customer", "No. HP", "Jml beli", "Total beli", "Jml buyback", "Total buyback"], rows: rows.map((r) => [r.name, r.phone, r.sales_count, r.sales_total, r.buyback_count, r.buyback_total]) };
    }
    case "sales": {
      const rows = await reportService.detail("sales", range, store);
      return {
        headers: ["Invoice", "Waktu", "Customer", "Barcode", "Barang", "Kadar", "Berat emas", "Harga/gram", "Harga", "Diskon", "Jumlah", "Modal", "Laba kotor"],
        rows: rows.map((r) => {
          const s = one(r.sale);
          return [s?.invoice_number as string, s?.sold_at as string, (one(s?.customer)?.name as string) ?? "", r.barcode as string, r.name as string, r.purity_code as string, r.gold_weight as string,
            money(r.sell_rate), money(r.subtotal), money(r.discount), money(r.price), money(r.cost_price), String(BigInt(money(r.price)) - BigInt(money(r.cost_price)))];
        }),
      };
    }
    case "buybacks": {
      const rows = await reportService.detail("buybacks", range, store);
      return {
        headers: ["Nomor", "Waktu", "Customer", "Barang", "Kadar", "Berat emas", "Harga/gram", "Bruto", "Potongan", "Neto"],
        rows: rows.map((r) => {
          const b = one(r.buyback);
          return [b?.buyback_number as string, b?.bought_at as string, (one(b?.customer)?.name as string) ?? "", r.name as string, r.purity_code as string, r.gold_weight as string,
            money(r.price_per_gram), money(r.gross_amount), money(r.deduction), money(r.net_amount)];
        }),
      };
    }
    case "purchases": {
      const rows = await reportService.detail("purchases", range, store);
      return {
        headers: ["Nomor", "Tanggal", "Supplier", "Invoice supplier", "Total", "Dibayar", "Status bayar", "Status"],
        rows: rows.map((r) => [r.purchase_number as string, r.purchase_date as string, (one(r.supplier)?.name as string) ?? "", (r.supplier_invoice as string) ?? "", money(r.total), money(r.paid_total), r.payment_status as string, r.status as string]),
      };
    }
    case "movements": {
      const rows = await reportService.detail("movements", range, store);
      return {
        headers: ["Waktu", "Jenis", "Barcode", "Barang", "Qty", "Berat emas", "Berat sebelum", "Berat sesudah", "Status dari", "Status ke", "Catatan"],
        rows: rows.map((r) => [r.created_at as string, MOVEMENT_LABELS[r.movement_type as string] ?? (r.movement_type as string), (one(r.inventory)?.barcode as string) ?? "", (one(r.inventory)?.name as string) ?? "",
          r.quantity as number, r.weight as string, (r.before_weight as string) ?? "", (r.after_weight as string) ?? "", (r.from_status as string) ?? "", (r.to_status as string) ?? "", (r.notes as string) ?? ""]),
      };
    }
    case "opname": {
      const rows = await reportService.detail("opname", range, store);
      return {
        headers: ["Nomor", "Outlet", "Status", "Mulai", "Disetujui", "Item sistem", "Item fisik", "Selisih item", "Berat sistem", "Berat fisik", "Selisih berat", "Nilai estimasi"],
        rows: rows.map((r) => [r.opname_number as string, (one(r.store)?.name as string) ?? "", r.status as string, r.started_at as string, (r.approved_at as string) ?? "",
          r.system_count as number, r.physical_count as number, r.diff_count as number, r.system_weight as string, r.physical_weight as string, r.diff_weight as string, money(r.estimated_value)]),
      };
    }
    default:
      return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  try {
    const csv = await build(kind, request.nextUrl.searchParams);
    if (!csv) return NextResponse.json({ success: false, message: "Laporan tidak dikenal", code: "NOT_FOUND" }, { status: 404 });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(csv.headers, csv.rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="goldpos-${kind}-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError) {
      const status = e.code === "UNAUTHENTICATED" ? 401 : e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ success: false, message: e.message, code: e.code }, { status });
    }
    console.error("[report csv]", e);
    return NextResponse.json({ success: false, message: "Terjadi kesalahan.", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
