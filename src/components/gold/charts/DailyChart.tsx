"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { DailyRow } from "@/server/services/report.service";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

/** Sales / buyback / purchase per day (values in rupiah). */
export default function DailyChart({ rows }: { rows: DailyRow[] }) {
  const categories = rows.map((r) => r.day.slice(5));
  const series = [
    { name: "Penjualan", data: rows.map((r) => Number(r.sales_total)) },
    { name: "Buyback", data: rows.map((r) => Number(r.buyback_total)) },
    { name: "Pembelian", data: rows.map((r) => Number(r.purchase_total)) },
  ];
  return (
    <Chart
      type="area"
      height={300}
      series={series}
      options={{
        chart: { toolbar: { show: false }, fontFamily: "inherit" },
        colors: ["#465fff", "#12b76a", "#f79009"],
        dataLabels: { enabled: false },
        stroke: { curve: "smooth", width: 2 },
        fill: { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0 } },
        xaxis: { categories },
        yaxis: { labels: { formatter: (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} jt` : new Intl.NumberFormat("id-ID").format(v)) } },
        tooltip: { y: { formatter: (v: number) => `Rp ${new Intl.NumberFormat("id-ID").format(v)}` } },
        legend: { position: "top" },
      }}
    />
  );
}
