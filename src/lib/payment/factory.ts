import { supabaseAdmin } from "@/lib/supabase-admin";
import { decryptSecret } from "@/lib/crypto";
import { getAppUrl } from "@/lib/appUrl";
import { PaymentProvider } from "./types";
import { XenditProvider } from "./providers/xendit";

export async function getPaymentProviderForStore(storeId: number): Promise<PaymentProvider> {
  const { data, error } = await supabaseAdmin
    .from("pos_payment_gateways")
    .select("provider, secret_key")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error(
      "Payment gateway belum dikonfigurasi untuk toko ini. Atur di Settings > Payment Gateway."
    );
  }

  const secretKey = decryptSecret(data.secret_key);
  const callbackUrl = `${getAppUrl()}/api/xendit/callback`;

  switch (data.provider) {
    case "xendit":
      return new XenditProvider(secretKey, callbackUrl);
    default:
      throw new Error(`Provider ${data.provider} belum didukung`);
  }
}
