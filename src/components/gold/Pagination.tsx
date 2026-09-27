import Link from "next/link";
import React from "react";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
};

export default function Pagination({ page, pageSize, total, basePath, params = {} }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const link = "rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700";

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
      <span>
        {total} data · Halaman {Math.min(page, pages)} dari {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? <Link className={`${link} hover:bg-gray-50 dark:hover:bg-white/5`} href={href(page - 1)}>Sebelumnya</Link> : <span className={`${link} opacity-40`}>Sebelumnya</span>}
        {page < pages ? <Link className={`${link} hover:bg-gray-50 dark:hover:bg-white/5`} href={href(page + 1)}>Berikutnya</Link> : <span className={`${link} opacity-40`}>Berikutnya</span>}
      </div>
    </div>
  );
}
