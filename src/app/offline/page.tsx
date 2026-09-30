export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 text-center">
      <div>
        <p className="text-4xl">📶</p>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Tidak ada koneksi internet</h1>
        <p className="mt-2 text-sm text-gray-500">
          UrangGold membutuhkan koneksi untuk menyimpan transaksi dengan aman. Periksa jaringan lalu coba lagi.
        </p>
      </div>
    </main>
  );
}
