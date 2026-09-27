import Link from "next/link";
import React from "react";

type Props = {
  title: string;
  description?: string;
  action?: { href: string; label: string } | null;
  back?: { href: string; label: string };
};

export default function PageHeader({ title, description, action, back }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
