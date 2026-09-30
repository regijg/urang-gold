import type { Metadata } from "next";
import Link from "next/link";
import RegisterForm from "@/components/auth/RegisterForm";
import { isRegistrationEnabled } from "@/server/services/auth.service";

export const metadata: Metadata = {
  title: "Daftar | UrangGold",
};

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  if (!isRegistrationEnabled()) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center lg:w-1/2">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Pendaftaran ditutup</h1>
        <p className="mt-2 text-sm text-gray-500">Pendaftaran toko baru sedang ditutup. Hubungi admin UrangGold.</p>
        <Link href="/login" className="mt-4 text-sm font-medium text-brand-500">Masuk</Link>
      </div>
    );
  }
  return <RegisterForm />;
}
