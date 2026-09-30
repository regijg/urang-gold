import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/gold/PageHeader";
import TenantProfileForm from "@/components/gold/TenantProfileForm";
import RolePermissionMatrix from "@/components/gold/RolePermissionMatrix";
import { formatDateTime } from "@/lib/format";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { settingsService } from "@/server/services/settings.service";
import { renameTenantAction } from "./actions";

export const metadata: Metadata = { title: "Pengaturan | UrangGold" };

const card = "rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900";

export default async function SettingsPage() {
  await requirePagePermission("tenant.manage");
  const [tenant, roles] = await loadPage(() => Promise.all([settingsService.tenant(), settingsService.roles()]));

  return (
    <>
      <PageHeader title="Pengaturan" description="Profil toko dan hak akses setiap role." />
      <div className="space-y-6">
        <section className={card}>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Profil Toko</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <TenantProfileForm action={renameTenantAction} name={tenant.name} />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Kode toko (slug)</dt><dd className="font-mono">{tenant.slug}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Paket</dt><dd className="font-medium text-gray-800 dark:text-white/90">{tenant.plan}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="font-medium text-gray-800 dark:text-white/90">{tenant.status === "ACTIVE" ? "Aktif" : tenant.status}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Terdaftar</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatDateTime(tenant.created_at)}</dd></div>
              <p className="pt-2 text-xs text-gray-400">
                Alamat, telepon, dan WhatsApp diatur per outlet di menu <Link href="/stores" className="text-brand-500 hover:underline">Outlet</Link>.
              </p>
            </dl>
          </div>
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Role & Hak Akses</h2>
              <p className="text-sm text-gray-500">Centang hak akses tiap role lalu klik Simpan. Menu dan akses pengguna ikut berubah.</p>
            </div>
            <Link href="/users" className="text-sm font-medium text-brand-500 hover:underline">Kelola pengguna →</Link>
          </div>
          <RolePermissionMatrix roles={roles} />
          <p className="mt-3 text-xs text-gray-400">
            Owner selalu punya semua akses. &quot;Khusus Owner&quot; tidak bisa diberikan ke role lain agar tidak ada yang bisa menaikkan dirinya menjadi owner.
            Owner &amp; Admin otomatis bisa mengakses semua outlet; role lain hanya outlet yang dicentang di data pengguna. Hak akses dicek ulang oleh database di setiap transaksi.
          </p>
        </section>
      </div>
    </>
  );
}
