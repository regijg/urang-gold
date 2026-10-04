import Link from "next/link";
import React from "react";
import UrangGoldLogo from "@/images/logo/uranggold-logo.svg";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { logoutAction } from "@/app/(full-width-pages)/(auth)/actions";
import { requirePlatformAdmin } from "@/server/auth/platform";

// Console for the owner of UrangGold itself. Server-side guard on every request; the actions re-check.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-(--breakpoint-2xl) items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/platform" className="flex items-center gap-3">
            <UrangGoldLogo className="h-8 w-auto text-gray-900 dark:text-white" />
            <span className="hidden rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 sm:inline">
              Platform
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 dark:text-gray-400 sm:inline">{admin.email}</span>
            <ThemeToggleButton />
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">{children}</main>
    </div>
  );
}
