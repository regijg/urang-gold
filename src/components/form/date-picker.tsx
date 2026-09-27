import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";

import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
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
  placeholder,
  maxDate,
  minDate,
}: PropsType) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    if (!inputRef.current) return;

    const fpInstance = flatpickr(inputRef.current, {
      mode: mode || "single",
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      defaultDate,
      onChange,
      maxDate,
      minDate,
    });

    if (defaultDate) {
      if (Array.isArray(defaultDate)) {
        if (defaultDate.length > 0) {
          const firstDate = defaultDate[0];
          if (typeof firstDate === "number") {
            inputRef.current.value = formatDate(new Date(firstDate));
          } else if (typeof firstDate === "string") {
            inputRef.current.value = firstDate;
          } else {
            inputRef.current.value = formatDate(firstDate);
          }
        }
      } else {
        if (typeof defaultDate === "number") {
          inputRef.current.value = formatDate(new Date(defaultDate));
        } else if (typeof defaultDate === "string") {
          inputRef.current.value = defaultDate;
        } else {
          inputRef.current.value = formatDate(defaultDate);
        }
      }
    }

    return () => {
      fpInstance.destroy();
    };
  }, [mode, onChange, id, defaultDate]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30  bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700  dark:focus:border-brand-800"
          readOnly // flatpickr menghandle input, lebih aman pakai readonly
        />

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
