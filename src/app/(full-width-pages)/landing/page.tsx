import Link from "next/link";
import {
  ArrowLeftRight,
  BarChart3,
  Barcode,
  ClipboardCheck,
  Coins,
  FileText,
  Globe,
  Lock,
  Receipt,
  ScanLine,
  Shield,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/LandingNavbar";

export const metadata: Metadata = {
  title: "UrangGold – Aplikasi Kasir & Stok Toko Emas",
  description: "Kasir, stok per keping dengan barcode, buyback, tukar tambah, kas harian, dan laporan laba untuk toko emas & perhiasan.",
};

const WA_URL = "https://wa.me/628988737264?text=Halo%2C+saya+ingin+tahu+tentang+UrangGold";

const features = [
  { icon: ShoppingCart, title: "Kasir cepat", desc: "Scan barcode, harga otomatis dari harga emas hari ini, split payment, nota cetak 58/80mm/A4 dan kirim via WhatsApp." },
  { icon: Barcode, title: "Stok per keping", desc: "Setiap perhiasan punya barcode dan berat aslinya sendiri. Tahu persis barang ada di etalase, baki, atau brankas mana." },
  { icon: Coins, title: "Buyback & tukar tambah", desc: "Beli kembali emas customer dengan harga beli resmi, atau tukar dengan barang baru — cukup bayar selisihnya." },
  { icon: Wallet, title: "Kas harian & biaya", desc: "Buka dan tutup kas per shift, catat uang keluar-masuk, dan biaya operasional supaya selisih laci langsung ketahuan." },
  { icon: ClipboardCheck, title: "Stock opname", desc: "Hitung fisik per baki dengan scan barcode. Barang hilang, salah tempat, atau beda berat terlihat jelas sebelum disetujui." },
  { icon: Receipt, title: "Pesanan & DP", desc: "Sisihkan barang untuk customer dengan uang muka, lunasi kapan saja, atau batalkan dan barang kembali ke etalase." },
  { icon: Wrench, title: "Servis perhiasan", desc: "Catat patri, cuci, ukir, atau ganti batu lengkap dengan ongkos dan status siap diambil." },
  { icon: BarChart3, title: "Laporan laba", desc: "Omzet, HPP, laba kotor dan bersih, emas terjual, nilai stok, serta hutang supplier — bisa diekspor ke CSV." },
];

const steps = [
  { title: "Atur harga emas", desc: "Isi harga jual & beli per kadar setiap pagi. Semua harga barang ikut otomatis." },
  { title: "Masukkan stok", desc: "Pilih produk, timbang tiap keping, cetak label barcode." },
  { title: "Jualan", desc: "Scan barcode di kasir, terima pembayaran, cetak atau kirim nota." },
  { title: "Tutup kas & cek laporan", desc: "Hitung uang di laci, lihat laba harian dan stok tersisa." },
];

const faqs = [
  { q: "Apakah harus pasang aplikasi?", a: "Tidak. UrangGold dibuka lewat browser di laptop, tablet, atau HP, dan bisa dipasang seperti aplikasi (PWA)." },
  { q: "Apakah data toko saya bisa dilihat toko lain?", a: "Tidak. Setiap toko terpisah di tingkat database; toko lain tidak bisa membaca data Anda walaupun memakai sistem yang sama." },
  { q: "Bagaimana dengan karyawan?", a: "Buat akun kasir, gudang, atau manager dan centang sendiri menu apa saja yang boleh mereka buka." },
  { q: "Bisa untuk lebih dari satu outlet?", a: "Bisa. Stok, kasir, dan laporan dipisah per outlet, dan barang bisa ditransfer antar outlet." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <LandingNavbar />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
        <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-300">
          <Smartphone size={14} /> Jalan di browser, laptop, tablet & HP
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Aplikasi kasir & stok untuk <span className="text-amber-400">toko emas</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-gray-400 sm:text-lg">
          Harga otomatis dari harga emas harian, stok per keping dengan barcode, buyback, tukar tambah, kas harian, dan laporan laba — semua di satu tempat.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={WA_URL} target="_blank" rel="noreferrer" className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white transition hover:bg-amber-600">
            Hubungi via WhatsApp
          </a>
          <Link href="/login" className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-gray-200 transition hover:bg-white/5">
            Masuk ke aplikasi
          </Link>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <h2 className="mb-2 text-center text-3xl font-bold">Semua yang dibutuhkan toko emas</h2>
        <p className="mb-10 text-center text-gray-400">Dari etalase sampai laporan akhir bulan.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <f.icon className="mb-3 text-amber-400" size={24} />
              <h3 className="mb-1.5 font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="alur" className="scroll-mt-20 border-y border-white/5 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-3xl font-bold">Cara kerjanya</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 p-5">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-sm font-bold">{i + 1}</span>
                <h3 className="mb-1.5 font-semibold">{s.title}</h3>
                <p className="text-sm text-gray-400">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="keamanan" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="mb-10 text-center text-3xl font-bold">Aman untuk barang bernilai tinggi</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Lock, title: "Data terpisah per toko", desc: "Dipisah di tingkat database, bukan hanya di tampilan." },
            { icon: Shield, title: "Hak akses per role", desc: "Kasir tidak melihat harga modal atau laporan kalau tidak diizinkan." },
            { icon: FileText, title: "Semua tercatat", desc: "Setiap mutasi stok, void, dan perubahan harga punya jejak siapa & kapan." },
            { icon: ScanLine, title: "Stock opname dengan persetujuan", desc: "Koreksi stok hanya berlaku setelah disetujui owner atau manager." },
            { icon: ArrowLeftRight, title: "Transaksi atomik", desc: "Penjualan, buyback, dan transfer tersimpan utuh atau tidak sama sekali." },
            { icon: Globe, title: "Katalog online opsional", desc: "Tampilkan stok & harga ke publik hanya jika Anda mengaktifkannya." },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 rounded-2xl border border-white/10 p-5">
              <f.icon className="shrink-0 text-amber-400" size={22} />
              <div>
                <h3 className="mb-1 font-semibold">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <h2 className="mb-8 text-center text-3xl font-bold">Pertanyaan umum</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-xl border border-white/10 p-5">
              <summary className="cursor-pointer list-none font-medium marker:hidden">{f.q}</summary>
              <p className="mt-3 text-sm text-gray-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-6 py-12 text-center">
          <Users className="mx-auto mb-4 text-amber-400" size={28} />
          <h2 className="text-2xl font-bold sm:text-3xl">Siap merapikan toko emas Anda?</h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-300">Ceritakan kebutuhan toko Anda, kami bantu siapkan akun dan data awalnya.</p>
          <a href={WA_URL} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white transition hover:bg-amber-600">
            Hubungi via WhatsApp
          </a>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} UrangGold. Hak cipta dilindungi undang-undang.
      </footer>
    </div>
  );
}
