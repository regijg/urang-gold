/**
 * Payment provider abstraction (master prompt §16).
 *
 * Today every payment is recorded manually by the cashier (MANUAL provider:
 * cash in the drawer, EDC card terminal, bank transfer checked by hand, static QRIS).
 * A gateway (e.g. dynamic QRIS / virtual account) can be added later by implementing
 * this interface and registering it — the database already stores `provider` and
 * `provider_ref` per payment, so no schema change is needed.
 */
import type { PaymentMethod } from "@/lib/payments";

export type PaymentRequest = { method: PaymentMethod; amount: string; reference: string | null };
export type RecordedPayment = PaymentRequest & { provider: string; provider_ref: string | null };

export interface PaymentProvider {
  readonly id: string; // stored in gold_payments.provider, ^[A-Z0-9_]{2,30}$
  supports(method: PaymentMethod): boolean;
  /** Confirms/prepares a payment before the sale is committed. Throw to abort. */
  prepare(request: PaymentRequest): Promise<RecordedPayment>;
}

const manualProvider: PaymentProvider = {
  id: "MANUAL",
  supports: () => true,
  async prepare(request) {
    return { ...request, provider: "MANUAL", provider_ref: null };
  },
};

const providers: PaymentProvider[] = [manualProvider];

export function providerFor(method: PaymentMethod): PaymentProvider {
  return providers.find((p) => p.supports(method)) ?? manualProvider;
}
