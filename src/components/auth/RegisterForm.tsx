"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import AuthFormField from "./AuthFormField";
import { registerAction } from "@/app/(full-width-pages)/(auth)/actions";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const message = state && !state.success ? state.message : undefined;

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full overflow-y-auto no-scrollbar">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto py-10">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">Daftarkan Toko</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Buat akun owner dan outlet pertama Anda.</p>
        </div>

        {message && (
          <div role="alert" className="mb-5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
            {message}
          </div>
        )}

        <form action={formAction} className="space-y-5" noValidate>
          <AuthFormField label="Nama Lengkap" name="fullName" autoComplete="name" placeholder="Nama pemilik" error={fieldErrors?.fullName} />
          <AuthFormField label="Email" name="email" type="email" autoComplete="email" placeholder="nama@toko.com" error={fieldErrors?.email} />
          <AuthFormField label="Password" name="password" type="password" autoComplete="new-password" placeholder="Minimal 8 karakter" error={fieldErrors?.password} />
          <AuthFormField label="Nama Usaha" name="tenantName" placeholder="Toko Emas Sejahtera" error={fieldErrors?.tenantName} />
          <AuthFormField
            label="Nama Outlet Pertama"
            name="storeName"
            placeholder="Outlet Pusat"
            hint="Boleh dikosongkan, akan memakai nama usaha."
            error={fieldErrors?.storeName}
          />
          <Button className="w-full" size="sm" type="submit" disabled={pending}>
            {pending ? "Memproses..." : "Daftar"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-center text-gray-700 dark:text-gray-400">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
