import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Akses ditolak</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Role Anda tidak memiliki akses ke halaman ini.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-brand-500 hover:text-brand-600">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
