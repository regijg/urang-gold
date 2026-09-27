import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nonaktifkan React Strict Mode biar useEffect tidak jalan 2x di DEV
  reactStrictMode: false,

  // Abaikan error ESLint saat build
  eslint: {
    ignoreDuringBuilds: true,
  },

  poweredByHeader: false,

  // Baseline security headers. (A strict CSP needs nonces for Next's inline
  // scripts; left out on purpose — see docs/goldpos/DEPLOYMENT.md.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  experimental: {
    serverActions: {
      // product photos are up to 2 MB (+ form fields / multipart overhead)
      bodySizeLimit: "3mb",
    },
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },

  images: {
    domains: [
      "www.muzakkitravelinternasional.com",
      "via.placeholder.com",
      "example.com",
      "api-pos.b2camp.id",
      "localhost",
      "127.0.0.1"
    ],
  },
};

export default nextConfig;
