import Image from "next/image";
import Link from "next/link";
import {
  ShoppingCart,
  BarChart3,
  Package,
  Users,
  TrendingUp,
  Store,
  CheckCircle,
  Star,
  ChevronRight,
  Smartphone,
  Shield,
  Zap,
  ClipboardList,
  ChefHat,
  QrCode,
  Plus,
  Settings,
  PlayCircle,
} from "lucide-react";
import { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/LandingNavbar";

export const metadata: Metadata = {
  title: "UrangApart – Property Management System untuk Apartemen",
  description:
    "Platform SaaS multi-tenant untuk mengelola apartemen, hunian, billing, maintenance, visitor, dan resident experience secara terpusat.",
};

const features = [
  {
    icon: ShoppingCart,
    title: "Resident Billing & Payment",
    desc: "Kelola tagihan bulanan, pembayaran, dan status tunggakan dari satu dashboard yang terintegrasi.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: Package,
    title: "Unit & Property Management",
    desc: "Kelola properti, tower, lantai, unit, dan status hunian dengan struktur data yang terorganisir.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    icon: BarChart3,
    title: "KPI Operasional",
    desc: "Pantau occupancy, revenue, outstanding bill, collection rate, dan performa maintenance secara real time.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    icon: TrendingUp,
    title: "Maintenance & Work Order",
    desc: "Kelola request maintenance, prioritas pekerjaan, dan progress teknisi dari satu platform.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: Users,
    title: "Resident & Owner Portal",
    desc: "Sediakan akses untuk resident, owner, dan tim operasional dengan role-based access yang aman.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
  },
  {
    icon: Store,
    title: "Multi Tenant",
    desc: "Satu platform untuk banyak pengelola properti. Data tiap tenant dipisahkan aman dengan multi-tenant architecture.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  {
    icon: ClipboardList,
    title: "Visitor & Package Management",
    desc: "Pantau kedatangan tamu, paket, dan akses visitor dengan alur yang terstruktur dan aman.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
  {
    icon: ChefHat,
    title: "Facility Booking",
    desc: "Reservasi fasilitas seperti gym, ruang serbaguna, dan area bersama dapat dikelola dengan mudah.",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  {
    icon: QrCode,
    title: "Digital Access & Notifications",
    desc: "Beri akses digital, pengumuman, dan notifikasi penting bagi resident serta tim operasional.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
  },
];

const screenshots = [
  {
    src: "/images/landing/sc-dashboard.png",
    title: "Dashboard Operasional",
    desc: "Pantau okupansi, tagihan, maintenance, dan aktivitas hunian dari satu tampilan.",
  },
  {
    src: "/images/landing/sc-kasir.png",
    title: "Portal Resident & Staff",
    desc: "Beri akses resident, owner, dan tim operasional dengan alur yang jelas dan aman.",
  },
  {
    src: "/images/landing/sc-list-produk.png",
    title: "Manajemen Properti",
    desc: "Kelola tower, lantai, unit, dan status hunian dengan struktur data yang terorganisir.",
  },
  {
    src: "/images/landing/sc-laporan-7-hari.png",
    title: "Laporan Lengkap",
    desc: "Analisis billing, maintenance, visitor, dan performa properti untuk keputusan yang lebih cerdas.",
  },
];

const moreScreenshots = [
  {
    src: "/images/landing/sc-antrian-pesanan.png",
    label: "Visitor & Paket",
  },
  {
    src: "/images/landing/sc-laporan-harian.png",
    label: "Tagihan Bulanan",
  },
  {
    src: "/images/landing/sc-trx.png",
    label: "Riwayat Permintaan",
  },
  {
    src: "/images/landing/sc-trx-detail.png",
    label: "Detail Unit",
  },
  {
    src: "/images/landing/sc-list-stock.png",
    label: "Booking Fasilitas",
  },
  {
    src: "/images/landing/sc-add-produk.png",
    label: "Pengumuman & Notifikasi",
  },
];

const pricingPlans = [
  {
    name: "Basic",
    price: "Rp 0",
    period: "/bulan",
    desc: "Cocok untuk pengelola apartemen kecil yang baru mengadopsi digital.",
    features: [
      "Kelola hingga 50 unit",
      "Tagihan bulanan & status pembayaran",
      "Pencatatan visitor & paket",
      "Pengumuman internal sederhana",
      "1 akun admin",
    ],
    cta: "Mulai Gratis",
    href: "https://wa.me/628988737264?text=Halo%2C+saya+ingin+daftar+UrangApart+paket+Basic",
    popular: false,
  },
  {
    name: "Pro",
    price: "Rp 299.000",
    period: "/bulan",
    desc: "Untuk pengelola properti yang butuh otomatisasi operasional lebih lengkap.",
    features: [
      "Semua fitur Basic",
      "Manajemen properti, unit, dan resident",
      "Billing, maintenance, dan facility booking",
      "Notifikasi otomatis untuk tenant & tamu",
      "Laporan okupansi & kolektibilitas",
      "Akses multi role untuk tim operasional",
    ],
    cta: "Coba 14 Hari Gratis",
    href: "https://wa.me/628988737264?text=Halo%2C+saya+ingin+daftar+UrangApart+paket+Pro",
    popular: true,
  },
];

const testimonials = [
  {
    name: "Budi Santoso",
    role: "Pengelola Apartemen 2 Tower",
    text: "UrangApart memudahkan kami mengelola tagihan bulanan, unit, dan pengumuman tanpa bergantung pada spreadsheet lagi.",
    rating: 5,
    avatar: "/images/user/user-01.jpg",
  },
  {
    name: "Siti Rahayu",
    role: "Manager Operasional",
    text: "Laporan occupancy dan maintenance jadi jauh lebih rapi. Tim kami bisa melihat prioritas pekerjaan secara real time.",
    rating: 5,
    avatar: "/images/user/user-02.jpg",
  },
  {
    name: "Andi Wijaya",
    role: "Admin Property",
    text: "Kami bisa mengelola resident, visitor, dan facility booking dari satu dashboard yang sama. Sangat praktis.",
    rating: 5,
    avatar: "/images/user/user-03.jpg",
  },
  {
    name: "Dewi Kusuma",
    role: "Owner Residence",
    text: "Sistem notifikasi-nya membantu sekali untuk memberi info penting ke penghuni tanpa harus repot mengirim manual.",
    rating: 5,
    avatar: "/images/user/user-17.jpg",
  },
  {
    name: "Reza Pratama",
    role: "Koordinator Maintenance",
    text: "Request maintenance jadi lebih tertata dan setiap pekerjaan punya status yang jelas dari awal sampai selesai.",
    rating: 5,
    avatar: "/images/user/user-18.jpg",
  },
  {
    name: "Maya Indah",
    role: "Supervisor Billing",
    text: "Setup-nya cepat, tampilan intuitif, dan semua data penting tersedia dengan sangat rapi.",
    rating: 5,
    avatar: "/images/user/user-20.jpg",
  },
];

const stats = [
  { value: "100+", label: "Properti Terkelola" },
  { value: "10K+", label: "Tagihan Terproses" },
  { value: "99.9%", label: "Uptime Server" },
  { value: "4.9/5", label: "Rating Pengguna" },
];

const howToSteps = [
  {
    icon: Plus,
    step: "01",
    title: "Daftar Gratis",
    desc: "Buat akun dalam hitungan menit. Tidak perlu instalasi rumit, langsung bisa dipakai.",
  },
  {
    icon: Settings,
    step: "02",
    title: "Setup Properti",
    desc: "Tambahkan unit, resident, billing, dan pengaturan operasional sesuai kebutuhan apartemen Anda.",
  },
  {
    icon: ShoppingCart,
    step: "03",
    title: "Kelola Operasional",
    desc: "Pantau tagihan, maintenance, visitor, dan pengumuman dari satu dashboard yang terpusat.",
  },
];

const faqs = [
  {
    q: "Apakah UrangApart benar-benar gratis?",
    a: "Ya. Paket Basic tersedia tanpa biaya untuk membantu pengelola properti kecil mulai digitalisasi operasional.",
  },
  {
    q: "Apakah bisa dipakai di HP tanpa install aplikasi?",
    a: "Tentu. UrangApart bisa diakses langsung dari browser HP manapun, sehingga tim operasional bisa bekerja dari mana saja.",
  },
  {
    q: "Bagaimana keamanan data apartemen saya?",
    a: "Data Anda dilindungi dengan enkripsi HTTPS, autentikasi berlapis, dan pemisahan data per tenant agar aman.",
  },
  {
    q: "Apakah bisa dipakai jika internet lambat?",
    a: "UrangApart dirancang responsif dan tetap nyaman dipakai saat koneksi tidak stabil.",
  },
  {
    q: "Apakah ada biaya setup atau biaya tersembunyi?",
    a: "Tidak ada. Anda hanya memilih paket sesuai kebutuhan, tanpa biaya setup atau kontrak panjang.",
  },
  {
    q: "Bisakah admin, manager, dan staff punya akses berbeda?",
    a: "Ya. UrangApart mendukung role-based access sehingga setiap tim bisa mengakses fitur sesuai tanggung jawabnya.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Navbar ──────────────────────────────────────── */}
      <LandingNavbar />

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-20 pt-20 sm:pt-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-400">
              <Zap size={14} />
              Platform manajemen apartemen modern untuk tim operasional
            </span>

            <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Kelola Apartemen Lebih{" "}
              <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">
                Cepat & Tertib
              </span>{" "}
              dengan UrangApart
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
              Platform SaaS untuk mengelola tenant, properti, unit, billing, maintenance, visitor,
              dan pengumuman dari satu dashboard yang mudah dipakai — bahkan di HP.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="https://wa.me/628988737264?text=Halo%2C+saya+ingin+daftar+UrangApart"
                target="_blank"
                className="flex items-center gap-2 rounded-xl bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600"
              >
                Mulai Gratis Sekarang
                <ChevronRight size={18} />
              </Link>
              <a
                href="#screenshots"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
              >
                <PlayCircle size={18} className="text-brand-400" />
                Lihat Tampilan
              </a>
            </div>

            <p className="mt-4 text-sm text-gray-500">
              Gratis selamanya · Tidak perlu kartu kredit · Setup dalam 5 menit
            </p>
          </div>

          {/* Hero screenshot */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-brand-500/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
              {/* [SCREENSHOT: sc-dashboard.png - tampilan dashboard utama UrangApart] */}
              <Image
                src="/images/landing/sc-dashboard.png"
                alt="UrangApart Dashboard"
                width={1280}
                height={720}
                className="w-full"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-gray-900/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-white sm:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1 text-sm text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Fitur Lengkap
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Semua yang Dibutuhkan Pengelola Properti
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Dari billing hingga maintenance, UrangApart hadir dengan fitur
              lengkap yang dirancang khusus untuk operasional apartemen modern.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className={`rounded-2xl border ${f.border} bg-gray-900/60 p-6 transition hover:-translate-y-1 hover:border-white/20`}
              >
                <div className={`mb-4 inline-flex rounded-xl ${f.bg} p-3`}>
                  <f.icon size={22} className={f.color} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Extra feature badges */}
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {[
              "Billing Otomatis",
              "Visitor Management",
              "Maintenance Tracking",
              "Export Laporan",
              "Booking Fasilitas",
              "Role-Based Access",
              "Notifikasi Real-time",
              "Multi Tenant",
              "Mobile Friendly",
              "Dark Mode",
              "Portal Resident",
            ].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-gray-300"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Screenshots ─────────────────────────────────── */}
      <section id="screenshots" className="bg-gray-900/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Tampilan Aplikasi
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Lihat UrangApart dalam Aksi
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Antarmuka yang bersih dan intuitif. Dirancang agar tim operasional dan
              penghuni bisa langsung pakai tanpa training panjang.
            </p>
          </div>

          {/* Main 4 screenshots */}
          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {screenshots.map((sc) => (
              <div
                key={sc.title}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-gray-900 transition hover:border-brand-500/50"
              >
                <div className="overflow-hidden">
                  <Image
                    src={sc.src}
                    alt={sc.title}
                    width={800}
                    height={450}
                    className="w-full transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-white">{sc.title}</h3>
                  <p className="mt-1 text-sm text-gray-400">{sc.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Additional screenshots grid */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {moreScreenshots.map((sc, i) => (
              <div
                key={i}
                className="group overflow-hidden rounded-xl border border-white/10 bg-gray-900"
              >
                <div className="overflow-hidden">
                  <Image
                    src={sc.src}
                    alt={sc.label}
                    width={400}
                    height={250}
                    className="w-full transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-gray-400">{sc.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How to Start ────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Cara Mulai
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Mulai dalam 3 Langkah Mudah
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Tidak perlu training. Tidak perlu teknisi. Langsung jalan dalam hitungan menit.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {howToSteps.map((step, i) => (
              <div key={i} className="relative text-center">
                {i < howToSteps.length - 1 && (
                  <div className="absolute left-1/2 top-8 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-brand-500/50 to-transparent sm:block" />
                )}
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/30">
                  <step.icon size={28} className="text-brand-400" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="https://wa.me/628988737264?text=Halo%2C+saya+ingin+daftar+UrangApart"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600"
            >
              Mulai Sekarang – Gratis
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why UrangApart ────────────────────────────────── */}
      <section className="bg-gray-900/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
                Mengapa UrangApart?
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Dirancang Khusus untuk Pengelola Properti
              </h2>
              <p className="mt-5 text-gray-400">
                Berbeda dengan sistem manual yang rumit dan tersebar, UrangApart
                dibuat dengan memahami kebutuhan nyata pengelola apartemen — simple,
                terjangkau, dan bisa langsung dipakai.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  { icon: Smartphone, text: "Mobile-first: bisa dipakai di HP seperti aplikasi native — tanpa perlu install berlebih" },
                  { icon: Shield, text: "Data aman: keamanan berlapis dengan HTTPS, enkripsi sesi, dan pemisahan data per properti" },
                  { icon: Zap, text: "Ringan & cepat: antarmuka operasional dirancang responsif dan mudah dipakai tanpa perlu training" },
                  { icon: Store, text: "Laporan terpusat: pantau billing, maintenance, dan occupancy dari satu dashboard" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-brand-500/10 p-1.5">
                      <Icon size={16} className="text-brand-400" />
                    </div>
                    <span className="text-gray-300">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-brand-500/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                {/* [SCREENSHOT: sc-kasir.png - tampilan layar kasir] */}
                <Image
                  src="/images/landing/sc-kasir.png"
                  alt="UrangApart Dashboard"
                  width={700}
                  height={500}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────── */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Harga Transparan
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Pilih Paket yang Sesuai
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Mulai gratis, upgrade kapan saja. Tidak ada biaya tersembunyi.
            </p>
          </div>

          <div className="mt-16 mx-auto max-w-3xl grid gap-6 sm:grid-cols-2 items-stretch">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-8 ${
                  plan.popular
                    ? "border-2 border-brand-500 bg-brand-500/5 ring-4 ring-brand-500/10 shadow-xl shadow-brand-500/10"
                    : "border border-white/10 bg-gray-900"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-brand-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-brand-500/30">
                      REKOMENDASI
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-400">{plan.desc}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className={`text-4xl font-extrabold ${plan.popular ? "text-brand-400" : "text-white"}`}>
                      {plan.price}
                    </span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <CheckCircle
                        size={16}
                        className={plan.popular ? "text-brand-400" : "text-emerald-400"}
                      />
                      <span className="text-sm text-gray-300">{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold transition ${
                    plan.popular
                      ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────── */}
      <section id="testimonials" className="bg-gray-900/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Testimoni
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Dipercaya Pengelola Properti
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Dengar langsung dari mereka yang sudah merasakan manfaat UrangApart.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-white/10 bg-gray-900 p-6"
              >
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mb-6 text-sm leading-relaxed text-gray-300">
                  &quot;{t.text}&quot;
                </p>
                <div className="flex items-center gap-3">
                  <Image
                    src={t.avatar}
                    alt={t.name}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────── */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              FAQ
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Pertanyaan yang Sering Ditanya
            </h2>
          </div>

          <div className="mt-12 space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-gray-900/60 p-6"
              >
                <h3 className="font-semibold text-white">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
            <p className="text-sm text-gray-300">
              Masih ada pertanyaan lain?{" "}
              <a
                href="https://wa.me/628988737264"
                className="font-semibold text-brand-400 hover:text-brand-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat langsung via WhatsApp
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-500 p-12 text-center shadow-2xl shadow-brand-500/30">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Siap Tingkatkan Bisnis Anda?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-brand-100">
                Bergabunglah dengan tim operasional yang sudah menggunakan UrangApart.
                Daftar gratis sekarang, tanpa kartu kredit.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="https://wa.me/628988737264?text=Halo%2C+saya+ingin+daftar+UrangApart"
                  target="_blank"
                  className="flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-brand-600 transition hover:bg-brand-50"
                >
                  Mulai Gratis Sekarang
                  <ChevronRight size={18} />
                </Link>
                <a
                  href="https://wa.me/628988737264"
                  className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/20"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tanya via WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer id="contact" className="border-t border-white/5 bg-gray-900/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Link href="/landing" className="flex items-center gap-2.5">
                <Image
                  src="/images/logo/umroh-logo.png"
                  alt="UrangApart"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold text-white">UrangApart</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm text-gray-400">
                Platform manajemen apartemen modern. Mudah, terjangkau, dan
                lengkap untuk semua skala pengelolaan properti.
              </p>
              <p className="mt-6 text-sm text-gray-500">
                Punya pertanyaan?{" "}
                <a
                  href="https://wa.me/628988737264"
                  className="text-brand-400 hover:text-brand-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Hubungi via WhatsApp
                </a>
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Produk
              </h4>
              <ul className="space-y-2">
                {[
                  { label: "Fitur", href: "#features" },
                  { label: "Harga", href: "#pricing" },
                  { label: "Tampilan", href: "#screenshots" },
                  { label: "FAQ", href: "#faq" },
                ].map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-gray-500 transition hover:text-white"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Perusahaan
              </h4>
              <ul className="space-y-2">
                {[
                  { label: "Tentang Kami", href: "/master-data/tentang-kami" },
                  { label: "Panduan", href: "/master-data/panduan" },
                  { label: "Kebijakan Privasi", href: "/master-data/kebijakan-privasi" },
                  { label: "Syarat & Ketentuan", href: "/master-data/ketentuan-layanan" },
                ].map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-gray-500 transition hover:text-white"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} UrangApart. Hak cipta dilindungi undang-undang.
            </p>
            <div className="flex gap-6">
              <a href="/master-data/kebijakan-privasi" className="text-sm text-gray-600 hover:text-gray-400">
                Kebijakan Privasi
              </a>
              <a href="/master-data/ketentuan-layanan" className="text-sm text-gray-600 hover:text-gray-400">
                Syarat & Ketentuan
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
