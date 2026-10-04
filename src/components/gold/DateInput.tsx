"use client";

import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { Indonesian } from "flatpickr/dist/l10n/id";
import "flatpickr/dist/flatpickr.css";

type Props = {
  name?: string;
  id?: string;
  /** Controlled value, "YYYY-MM-DD" ("" = empty). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

/** "YYYY-MM-DD" → local Date (no UTC shift). */
const toDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`) : undefined);

/**
 * Drop-in for `<input type="date">` that opens a calendar instead of being typed into.
 * A hidden input carries `name` = "YYYY-MM-DD"; flatpickr only drives the visible one ("5 Okt 2026").
 * The two are kept separate because React re-applies props (type, class) to inputs it renders,
 * which would undo flatpickr's own altInput setup on every re-render.
 * Picking a date dispatches a native `change` event on the hidden input (FilterForm listens for it).
 */
export default function DateInput({ name, id, value, defaultValue, onChange, min, max, placeholder = "Pilih tanggal", className, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const current = value ?? defaultValue ?? "";

  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      locale: Indonesian,
      dateFormat: "j M Y",
      disableMobile: true,
      monthSelectorType: "static",
      defaultDate: toDate(current),
      minDate: toDate(min),
      maxDate: toDate(max),
      onChange: (dates, _str, inst) => {
        const iso = dates[0] ? inst.formatDate(dates[0], "Y-m-d") : "";
        const hidden = hiddenRef.current;
        if (hidden) {
          hidden.value = iso;
          hidden.dispatchEvent(new Event("change", { bubbles: true }));
        }
        onChangeRef.current?.(iso);
      },
    });
    fpRef.current = fp;
    return () => {
      fp.destroy();
      fpRef.current = null;
    };
    // flatpickr is created once; later prop changes are synced by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // follow value / defaultValue changes (e.g. a range preset rewrites the dates)
  useEffect(() => {
    const fp = fpRef.current;
    if (hiddenRef.current) hiddenRef.current.value = current;
    if (!fp) return;
    const shown = fp.selectedDates[0] ? fp.formatDate(fp.selectedDates[0], "Y-m-d") : "";
    if (shown === current) return;
    if (current) fp.setDate(toDate(current)!, false);
    else fp.clear(false);
  }, [current]);

  useEffect(() => {
    const fp = fpRef.current;
    if (fp && fp.config.minDate?.getTime() !== toDate(min)?.getTime()) fp.set("minDate", toDate(min));
  }, [min]);

  useEffect(() => {
    const fp = fpRef.current;
    if (fp && fp.config.maxDate?.getTime() !== toDate(max)?.getTime()) fp.set("maxDate", toDate(max));
  }, [max]);

  return (
    <div className="relative">
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={current} />
      <input
        ref={inputRef}
        id={id}
        type="text"
        placeholder={placeholder}
        className={`${className ?? ""} cursor-pointer pr-10`}
        readOnly
        {...rest}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400">
        {/* inline (not @/icons): svgr strips the viewBox, so a resized CalenderIcon gets cropped */}
        <svg className="block size-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M8 2C8.41421 2 8.75 2.33579 8.75 2.75V3.75H15.25V2.75C15.25 2.33579 15.5858 2 16 2C16.4142 2 16.75 2.33579 16.75 2.75V3.75H18.5C19.7426 3.75 20.75 4.75736 20.75 6V9V19C20.75 20.2426 19.7426 21.25 18.5 21.25H5.5C4.25736 21.25 3.25 20.2426 3.25 19V9V6C3.25 4.75736 4.25736 3.75 5.5 3.75H7.25V2.75C7.25 2.33579 7.58579 2 8 2ZM8 5.25H5.5C5.08579 5.25 4.75 5.58579 4.75 6V8.25H19.25V6C19.25 5.58579 18.9142 5.25 18.5 5.25H16H8ZM19.25 9.75H4.75V19C4.75 19.4142 5.08579 19.75 5.5 19.75H18.5C18.9142 19.75 19.25 19.4142 19.25 19V9.75Z"
            fill="currentColor"
          />
        </svg>
      </span>
    </div>
  );
}
