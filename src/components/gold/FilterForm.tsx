"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useTransition } from "react";

/**
 * GET filter form without a full page reload: fields are written to the URL via client
 * navigation (server components re-render with the new searchParams). Selects apply
 * immediately, text/date inputs after a short pause, Enter applies right away.
 * While loading, the content after the form is dimmed (see `.filter-form` in globals.css).
 */
export default function FilterForm({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // DateInput (calendar) sets a hidden input and fires a native change event React doesn't report
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const onNativeChange = (e: Event) => {
      if (e.target instanceof HTMLInputElement && e.target.type === "hidden") applyRef.current();
    };
    form.addEventListener("change", onNativeChange);
    return () => form.removeEventListener("change", onNativeChange);
  }, []);

  function apply() {
    clearTimeout(timer.current);
    const form = ref.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || !el.name) continue;
      // an empty select still matters ("Semua status" differs from the page default)
      if (el.value !== "" || el instanceof HTMLSelectElement) params.set(el.name, el.value);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const applyRef = useRef(apply);
  applyRef.current = apply;

  function onChange(e: React.FormEvent<HTMLFormElement>) {
    const t = e.target;
    if (t instanceof HTMLSelectElement) return apply();
    if (t instanceof HTMLInputElement) {
      clearTimeout(timer.current);
      timer.current = setTimeout(apply, 400);
    }
  }

  return (
    <form
      ref={ref}
      autoComplete="off"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onChange={onChange}
      className={`filter-form ${className ?? ""}`}
      aria-busy={pending}
    >
      {children}
      {/* keeps Enter-to-apply working when the form has several fields */}
      <button type="submit" className="sr-only">
        Terapkan
      </button>
    </form>
  );
}
