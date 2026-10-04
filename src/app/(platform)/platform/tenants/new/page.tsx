import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import TenantForm from "@/components/platform/TenantForm";
import { createTenantAction } from "../../actions";

export const metadata: Metadata = { title: "Toko Baru | UrangGold Platform" };

export default function NewTenantPage() {
  return (
    <>
      <PageHeader
        title="Toko Baru"
        description="Membuat toko lengkap dengan outlet pertama dan akun owner. Pelanggan tinggal login memakai email dan password ini."
        back={{ href: "/platform", label: "Toko Pelanggan" }}
      />
      <TenantForm action={createTenantAction} />
    </>
  );
}
