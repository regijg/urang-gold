"use client";

import { CheckCircle, X } from "lucide-react";

const STARTER_FEATURES = [
  "Tidak terbatas untuk properti & unit",
  "Semua modul apartemen siap dipakai",
  "Laporan okupansi, tagihan, dan maintenance",
  "Notifikasi otomatis untuk tenant & tamu",
  "Manajemen booking fasilitas dan parkir",
  "Akses role-based untuk admin, manager, dan staff",
  "Pencatatan pengeluaran dan pembayaran bulanan",
];

type Props = {
  onClose: () => void;
};

export default function UpgradeModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border-2 border-brand-500 bg-brand-500/5 ring-4 ring-brand-500/10 shadow-2xl shadow-brand-500/20 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Badge */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-brand-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-brand-500/30">
            STARTER
          </span>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-6 mt-2 text-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Fitur Paket Premium</h3>
          <p className="mt-1 text-sm text-gray-400">Upgrade untuk membuka operasional apartemen yang lebih luas</p>
          <div className="mt-4 flex items-baseline justify-center gap-1">
            <span className="text-3xl font-extrabold text-brand-400">Rp 149.000</span>
            <span className="text-gray-400 text-sm">/bulan</span>
          </div>
        </div>

        {/* Features */}
        <ul className="mb-6 space-y-2.5">
          {STARTER_FEATURES.map((feat) => (
            <li key={feat} className="flex items-center gap-2.5">
              <CheckCircle size={15} className="text-brand-400 shrink-0" />
              <span className="text-sm text-gray-300">{feat}</span>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10 transition"
          >
            Tutup
          </button>
          <a
            href="https://wa.me/628988737264"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 rounded-xl bg-brand-500 text-sm font-semibold text-white text-center shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition"
          >
            Hubungi Admin
          </a>
        </div>
      </div>
    </div>
  );
}
