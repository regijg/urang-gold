"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/action-result";

const inputBase =
  "w-full rounded-lg border px-4 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30";
const inputOk =
  "border-gray-300 bg-transparent text-gray-800 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 dark:focus:border-brand-800";
const inputErr = "border-error-500 focus:border-error-300 focus:ring-error-500/10 dark:border-error-500";

export function fieldErrorsOf(state: ActionResult<unknown> | null): Record<string, string> {
  return state && !state.success ? (state.fieldErrors ?? {}) : {};
}

type FieldProps = { label: string; name: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode };

export function Field({ label, name, error, hint, required, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
        {label}
        {required && <span className="text-error-500"> *</span>}
      </label>
      {children}
      {(error || hint) && (
        <p className={`mt-1.5 text-xs ${error ? "text-error-500" : "text-gray-500 dark:text-gray-400"}`}>{error ?? hint}</p>
      )}
    </div>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  suffix?: string;
};

export function TextField({ name, label, error, hint, suffix, required, className, ...rest }: InputProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} required={required}>
      <div className="relative">
        <input
          id={name}
          name={name}
          aria-invalid={!!error}
          className={`${inputBase} h-11 ${error ? inputErr : inputOk} ${suffix ? "pr-16" : ""} ${className ?? ""}`}
          {...rest}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-400">{suffix}</span>}
      </div>
    </Field>
  );
}

/** Rupiah input: free text, parsed on the server ("8.500.000" or "8500000"). */
export function CurrencyField(props: Omit<InputProps, "suffix">) {
  return <TextField inputMode="numeric" placeholder="0" {...props} suffix="IDR" />;
}

/** Gram input: accepts "3,21" or "3.21", parsed on the server. */
export function WeightField(props: Omit<InputProps, "suffix">) {
  return <TextField inputMode="decimal" placeholder="0,000" {...props} suffix="gram" />;
}

type TextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
};

export function TextAreaField({ name, label, error, hint, required, ...rest }: TextAreaProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} required={required}>
      <textarea id={name} name={name} rows={3} aria-invalid={!!error} className={`${inputBase} py-2.5 ${error ? inputErr : inputOk}`} {...rest} />
    </Field>
  );
}

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
};

export function SelectField({ name, label, error, hint, required, placeholder, options, ...rest }: SelectProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} required={required}>
      <select id={name} name={name} aria-invalid={!!error} className={`${inputBase} h-11 ${error ? inputErr : inputOk}`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
      {label}
    </label>
  );
}

export function FormAlert({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.success) return null;
  return (
    <div role="alert" className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
      {state.message}
    </div>
  );
}

export function SubmitButton({ children = "Simpan" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Menyimpan..." : children}
    </button>
  );
}

export function FormCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">{children}</div>;
}
