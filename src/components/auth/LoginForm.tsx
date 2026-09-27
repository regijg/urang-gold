"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import AuthFormField from "./AuthFormField";
import { loginAction } from "@/app/(full-width-pages)/(auth)/actions";

const SESSION_ERRORS: Record<string, string> = {
  session: "Sesi tidak valid atau akun belum aktif. Silakan login kembali.",
};

export default function LoginForm({ next, error }: { next?: string; error?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const message = state && !state.success ? state.message : error ? SESSION_ERRORS[error] : undefined;

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">Masuk</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Masukkan email dan password akun GoldPOS Anda.</p>
        </div>

        {message && (
          <div role="alert" className="mb-5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
            {message}
          </div>
        )}

        <form action={formAction} className="space-y-5" noValidate>
          <input type="hidden" name="next" value={next ?? ""} />
          <AuthFormField label="Email" name="email" type="email" autoComplete="email" placeholder="nama@toko.com" error={fieldErrors?.email} />
          <AuthFormField label="Password" name="password" type="password" autoComplete="current-password" placeholder="Password" error={fieldErrors?.password} />
          <Button className="w-full" size="sm" type="submit" disabled={pending}>
            {pending ? "Memproses..." : "Masuk"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-center text-gray-700 dark:text-gray-400">
          Belum punya akun?{" "}
          <Link href="/register" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">
            Daftarkan toko Anda
          </Link>
        </p>
      </div>
    </div>
  );
}
