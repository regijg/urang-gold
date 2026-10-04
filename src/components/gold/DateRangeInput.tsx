"use client";

import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { Indonesian } from "flatpickr/dist/l10n/id";
import "flatpickr/dist/flatpickr.css";

type Props = {
  /** "YYYY-MM-DD" */
  from: string;
  to: string;
  max?: string;
  /** Open the calendar right after mounting (the user just asked for a custom range). */
  autoOpen?: boolean;
  /** Called once the range is complete (calendar closed); a single picked day becomes from = to. */
  onChange: (from: string, to: string) => void;
  className?: string;
  "aria-label"?: string;
};

const toDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`) : undefined);

/** One field, one calendar: start and end are picked in order, so the end can never precede the start. */
export default function DateRangeInput({ from, to, max, autoOpen, onChange, className, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** First day picked while choosing a range: days before it are disabled until the end is picked. */
  const pendingStart = useRef<Date | null>(null);
  const committed = useRef({ from, to });
  committed.current = { from, to };

  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      locale: { ...Indonesian, rangeSeparator: "  –  " },
      mode: "range",
      dateFormat: "j M Y",
      disableMobile: true,
      monthSelectorType: "static",
      showMonths: window.matchMedia("(min-width: 768px)").matches ? 2 : 1,
      defaultDate: [toDate(from), toDate(to)].filter(Boolean) as Date[],
      maxDate: toDate(max),
      disable: [(d: Date) => !!pendingStart.current && d < pendingStart.current],
      onChange: (dates, _str, inst) => {
        pendingStart.current = dates.length === 1 ? dates[0] : null;
        inst.redraw();
      },
      // with two months, put the range end in the right-hand one (the left shows the month before)
      onOpen: (dates, _str, inst) => {
        const end = dates[1] ?? dates[0] ?? new Date();
        inst.jumpToDate(end);
        if (inst.config.showMonths > 1) inst.changeMonth(-1);
      },
      onClose: (dates, _str, inst) => {
        pendingStart.current = null;
        inst.redraw();
        const prev = committed.current;
        if (dates.length === 0) {
          // closed without picking: show the applied range again
          inst.setDate([toDate(prev.from)!, toDate(prev.to)!], false);
          return;
        }
        const start = inst.formatDate(dates[0], "Y-m-d");
        const end = inst.formatDate(dates[1] ?? dates[0], "Y-m-d");
        if (dates.length === 1) inst.setDate([dates[0], dates[0]], false);
        if (start !== prev.from || end !== prev.to) onChangeRef.current(start, end);
      },
    });
    fpRef.current = fp;
    if (autoOpen) fp.open();
    return () => {
      fp.destroy();
      fpRef.current = null;
    };
    // flatpickr is created once; later prop changes are synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp || fp.isOpen) return;
    const [a, b] = fp.selectedDates;
    if (a && b && fp.formatDate(a, "Y-m-d") === from && fp.formatDate(b, "Y-m-d") === to) return;
    fp.setDate([toDate(from)!, toDate(to)!], false);
  }, [from, to]);

  useEffect(() => {
    const fp = fpRef.current;
    // set() redraws and jumps back to the current month, so only call it on a real change
    if (fp && fp.config.maxDate?.getTime() !== toDate(max)?.getTime()) fp.set("maxDate", toDate(max));
  }, [max]);

  return (
    <div className="relative">
      <input ref={inputRef} type="text" readOnly placeholder="Pilih rentang tanggal" className={`${className ?? ""} cursor-pointer pr-10`} {...rest} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400">
        {/* same inline calendar glyph as DateInput (svgr strips the viewBox of @/icons) */}
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
