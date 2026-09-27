import { PaymentProvider, QrPaymentResult } from "../types";

const XENDIT_API_URL = "https://api.xendit.co";

export class XenditProvider implements PaymentProvider {
  constructor(private secretKey: string, private callbackUrl: string) {}

  private authHeader() {
    return "Basic " + Buffer.from(`${this.secretKey}:`).toString("base64");
  }

  async createQrPayment({
    externalId,
    amount,
  }: {
    externalId: string;
    amount: number;
  }): Promise<QrPaymentResult> {
    const res = await fetch(`${XENDIT_API_URL}/qr_codes`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: externalId,
        type: "DYNAMIC",
        callback_url: this.callbackUrl,
        amount,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Gagal membuat QRIS Xendit");
    return { id: data.id, qrString: data.qr_string, status: data.status };
  }

  async getQrPayment(id: string): Promise<QrPaymentResult> {
    const res = await fetch(`${XENDIT_API_URL}/qr_codes/${id}`, {
      headers: { Authorization: this.authHeader() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Gagal mengambil status QRIS Xendit");
    return { id: data.id, qrString: data.qr_string, status: data.status };
  }

  async testConnection(): Promise<{ connected: boolean; message: string }> {
    const res = await fetch(`${XENDIT_API_URL}/qr_codes/qr_connection-test-${Math.random().toString(36).slice(2)}`, {
      headers: { Authorization: this.authHeader() },
    });
    if (res.status === 401) {
      return { connected: false, message: "API Key tidak valid" };
    }
    return { connected: true, message: "Berhasil terhubung ke Xendit" };
  }
}
