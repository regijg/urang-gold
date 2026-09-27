"use client";

import JsBarcode from "jsbarcode";
import React, { useEffect, useRef } from "react";

export type LabelItem = { id: string; barcode: string; name: string; purity: string; weight: string; price?: string };

function Label({ item }: { item: LabelItem }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, item.barcode, { format: "CODE128", width: 1.4, height: 34, fontSize: 11, margin: 0 });
    }
  }, [item.barcode]);
  return (
    <div className="break-inside-avoid rounded border border-gray-300 bg-white p-2 text-center text-black">
      <p className="truncate text-[11px] font-semibold">{item.name}</p>
      <p className="text-[10px]">
        {item.purity} · {item.weight}
      </p>
      <svg ref={ref} className="mx-auto" />
      {item.price && <p className="text-[11px] font-semibold">{item.price}</p>}
    </div>
  );
}

export default function BarcodeLabels({ items }: { items: LabelItem[] }) {
  return (
    <div>
      <div className="mb-4 flex gap-3 print:hidden">
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
          Cetak
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {items.map((i) => (
          <Label key={i.id} item={i} />
        ))}
      </div>
    </div>
  );
}
