"use client";

import React from "react";
import { groupThousands, onlyDigits } from "@/lib/format";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** digits only, e.g. "1500000" */
  value: string;
  onValueChange: (digits: string) => void;
};

/**
 * Money input: shows "Rp" and thousand separators while typing (1.500.000),
 * keeps plain digits in state. The submitted value ("1.500.000") is parsed on
 * the server by parseRupiah.
 */
export default function RupiahInput({ value, onValueChange, className = "", ...rest }: Props) {
  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">Rp</span>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={groupThousands(value)}
        onChange={(e) => onValueChange(onlyDigits(e.target.value))}
        className={`${className} !pl-10`}
      />
    </div>
  );
}
