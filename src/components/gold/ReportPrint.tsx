import React from "react";

/** Letterhead shown only on paper: shop, report, period, outlet and who/when. */
export function ReportPrintHeader({
  tenantName,
  title,
  period,
  storeName,
  generatedAt,
  generatedBy,
}: {
  tenantName: string;
  title: string;
  period: string;
  storeName: string;
  generatedAt: string;
  generatedBy: string;
}) {
  return (
    <div className="mb-4 hidden border-b-2 border-gray-800 pb-3 text-gray-900 print:block">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xl font-bold leading-tight">{tenantName}</p>
          <p className="text-base font-semibold">Laporan {title}</p>
        </div>
        <dl className="text-right text-xs leading-5">
          <div>
            <dt className="inline text-gray-600">Periode: </dt>
            <dd className="inline font-medium">{period}</dd>
          </div>
          <div>
            <dt className="inline text-gray-600">Outlet: </dt>
            <dd className="inline font-medium">{storeName}</dd>
          </div>
          <div>
            <dt className="inline text-gray-600">Data per: </dt>
            <dd className="inline font-medium">
              {generatedAt} · {generatedBy}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

/** Closing block shown only on paper: signature boxes and source line. */
export function ReportPrintFooter() {
  return (
    <div className="mt-8 hidden text-gray-900 print:block" style={{ breakInside: "avoid" }}>
      <div className="grid grid-cols-3 gap-8 text-center text-xs">
        {["Dibuat oleh", "Diperiksa oleh", "Disetujui (Owner)"].map((label) => (
          <div key={label}>
            <p className="text-gray-600">{label}</p>
            <div className="h-16" />
            <p className="border-t border-gray-500 pt-1 text-gray-500">Nama &amp; tanggal</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[10px] text-gray-500">Dicetak dari UrangGold</p>
    </div>
  );
}
