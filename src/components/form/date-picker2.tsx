import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";

import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id?: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  value?: string | Date; // ✅ ditambahkan
  label?: string;
  placeholder?: string;
  maxDate?: DateOption;
  minDate?: Date;
};

export default function DatePicker({
  id,
  mode,
  onChange,
  label,
  defaultDate,
  value, // ✅ tambahkan di sini juga
  placeholder,
  maxDate,
}: PropsType) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const dObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dObj.getTime())) return "";
    const y = dObj.getFullYear();
    const m = (dObj.getMonth() + 1).toString().padStart(2, "0");
    const d = dObj.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    if (!inputRef.current) return;

    const fpInstance = flatpickr(inputRef.current, {
      mode: mode || "single",
      static: true,
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      defaultDate: value || defaultDate, // ✅ gunakan value jika ada
      onChange,
      maxDate,
    });

    // jika value berubah setelah render pertama, update manual
    if (value && inputRef.current) {
      if (typeof value === "string") {
        inputRef.current.value = value;
      } else {
        inputRef.current.value = formatDate(value);
      }
    }

    return () => {
      fpInstance.destroy();
    };
  }, [mode, onChange, id, defaultDate, value, maxDate]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800"
          readOnly
        />

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
