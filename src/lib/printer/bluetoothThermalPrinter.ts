"use client";

// @ts-expect-error - paket tidak menyertakan declaration file sendiri
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";

type ReceiptData = {
  merchantName?: string;
  merchantAddress?: string;
  merchantPhone?: string;
  orderCode?: string;
  cashierName?: string;
  customerName?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal?: number;
  discountAmount?: number;
  discountLabel?: string;
  taxAmount?: number;
  taxLabel?: string;
  serviceChargeAmount?: number;
  serviceChargeLabel?: string;
  total: number;
  paymentMethod?: string;
  paid: number;
};

// Profil GATT generik yang paling umum dipakai printer thermal Bluetooth murah (58mm).
// Kalau printer tidak cocok/gagal connect, cek UUID service/characteristic asli printernya
// (mis. lewat chrome://bluetooth-internals atau log device.gatt.getPrimaryServices()) lalu
// sesuaikan dua konstanta ini — ini tidak bisa dipastikan tanpa test ke unit fisiknya.
const PRINTER_SERVICE_UUID        = "000018f0-0000-1000-8000-00805f9b34fb";
const PRINTER_CHARACTERISTIC_UUID = "00002af1-0000-1000-8000-00805f9b34fb";

// Printer BLE murah umumnya punya MTU kecil — kirim per potongan kecil dengan jeda,
// bukan sekaligus, supaya data tidak terpotong/gagal print.
const CHUNK_SIZE     = 20;
const CHUNK_DELAY_MS = 20;

// 58mm dengan font default ESC/POS ≈ 32 karakter per baris.
const COLUMNS = 32;

const METHOD_LABEL: Record<string, string> = {
  cash:     "Tunai",
  qris:     "QRIS",
  transfer: "Transfer",
  ewallet:  "E-Wallet",
};

let cachedCharacteristic: any = null;

export function isBluetoothPrintSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getCharacteristic(): Promise<any> {
  if (cachedCharacteristic?.service?.device?.gatt?.connected) {
    return cachedCharacteristic;
  }

  const bluetooth = (navigator as any).bluetooth;
  if (!bluetooth) throw new Error("Web Bluetooth tidak didukung browser ini");

  const device = await bluetooth.requestDevice({
    filters:          [{ services: [PRINTER_SERVICE_UUID] }],
    optionalServices: [PRINTER_SERVICE_UUID],
  });

  const server         = await device.gatt.connect();
  const service        = await server.getPrimaryService(PRINTER_SERVICE_UUID);
  const characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC_UUID);

  cachedCharacteristic = characteristic;
  return characteristic;
}

// Baris dengan label di kiri & nilai rata kanan, dipotong kalau kepanjangan untuk kolom 32 char
function row(label: string, value: string): string {
  const space = COLUMNS - label.length - value.length;
  return space > 0 ? label + " ".repeat(space) + value : `${label} ${value}`;
}

function buildEscPosBytes(data: ReceiptData): Uint8Array {
  const encoder = new ReceiptPrinterEncoder({ language: "esc-pos", columns: COLUMNS });
  const now = new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const divider = "-".repeat(COLUMNS);

  encoder.align("center").bold(true).line(data.merchantName || "UrangApart").bold(false);
  if (data.merchantAddress) encoder.line(data.merchantAddress);
  if (data.merchantPhone)   encoder.line(data.merchantPhone);

  encoder.align("left").line(divider);
  encoder.line(`#${data.orderCode}`);
  encoder.line(now);
  if (data.cashierName) encoder.line(`Kasir: ${data.cashierName}`);
  encoder.line(`Pelanggan: ${data.customerName || "Umum"}`);
  encoder.line(divider);

  data.items.forEach((item) => {
    encoder.line(item.name);
    const left  = `  ${item.qty} x ${item.price.toLocaleString("id-ID")}`;
    const right = (item.qty * item.price).toLocaleString("id-ID");
    encoder.line(row(left, right));
  });
  encoder.line(divider);

  if (data.subtotal !== undefined) {
    encoder.line(row("Subtotal", `Rp ${data.subtotal.toLocaleString("id-ID")}`));
  }
  if ((data.discountAmount ?? 0) > 0) {
    encoder.line(row(data.discountLabel ?? "Diskon", `-Rp ${data.discountAmount!.toLocaleString("id-ID")}`));
  }
  if ((data.taxAmount ?? 0) > 0) {
    encoder.line(row(data.taxLabel ?? "Pajak", `Rp ${data.taxAmount!.toLocaleString("id-ID")}`));
  }
  if ((data.serviceChargeAmount ?? 0) > 0) {
    encoder.line(row(data.serviceChargeLabel ?? "Biaya Layanan", `Rp ${data.serviceChargeAmount!.toLocaleString("id-ID")}`));
  }

  encoder.bold(true).line(row("TOTAL", `Rp ${data.total.toLocaleString("id-ID")}`)).bold(false);
  encoder.line(row((data.paymentMethod && METHOD_LABEL[data.paymentMethod]) || (data.paymentMethod ?? "-"), `Rp ${data.paid.toLocaleString("id-ID")}`));

  const change = Math.max(0, data.paid - data.total);
  if (change > 0) encoder.line(row("Kembalian", `Rp ${change.toLocaleString("id-ID")}`));

  encoder.line(divider);
  encoder.align("center").line("Terima kasih!").line("Powered by UrangApart");
  encoder.newline(2).cut();

  return encoder.encode();
}

export async function printReceiptViaBluetooth(data: ReceiptData): Promise<void> {
  const characteristic = await getCharacteristic();
  const bytes = buildEscPosBytes(data);
  const canWriteWithoutResponse = typeof characteristic.writeValueWithoutResponse === "function";

  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
    if (canWriteWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await sleep(CHUNK_DELAY_MS);
  }
}
