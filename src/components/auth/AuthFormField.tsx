import React from "react";
import Label from "@/components/form/Label";

type Props = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
};

// Uncontrolled input so the form works with server actions (FormData) as-is.
export default function AuthFormField({ label, name, type = "text", placeholder, autoComplete, error, hint }: Props) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        className={`h-11 w-full rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 ${
          error
            ? "border-error-500 focus:border-error-300 focus:ring-error-500/10 dark:border-error-500"
            : "border-gray-300 bg-transparent text-gray-800 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 dark:focus:border-brand-800"
        }`}
      />
      {(error || hint) && (
        <p className={`mt-1.5 text-xs ${error ? "text-error-500" : "text-gray-500 dark:text-gray-400"}`}>{error ?? hint}</p>
      )}
    </div>
  );
}
