import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UrangGold — Sistem Toko Emas",
    short_name: "UrangGold",
    description: "Kasir, inventory, buyback, dan laporan untuk toko emas & perhiasan.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#C9A227",
    lang: "id",
    icons: [
      { src: "/icons/goldpos-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/goldpos-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/goldpos-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Kasir", url: "/sales/new" },
      { name: "Buyback", url: "/buybacks/new" },
    ],
  };
}
