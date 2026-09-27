export type QrPaymentResult = {
  id: string;
  qrString: string;
  status: string;
};

export interface PaymentProvider {
  createQrPayment(params: { externalId: string; amount: number }): Promise<QrPaymentResult>;
  getQrPayment(id: string): Promise<QrPaymentResult>;
  testConnection(): Promise<{ connected: boolean; message: string }>;
}
