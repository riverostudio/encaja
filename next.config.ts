import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Sin esto la base no viaja con la función y el servidor arranca vacío.
  outputFileTracingIncludes: {
    "/*": ["./data/radar-publico.db"],
  },
  async headers() {
    const seguridad = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "connect-src 'self'",
          "font-src 'self' data:",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "img-src 'self' data: blob:",
          "object-src 'none'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "upgrade-insecure-requests",
        ].join("; "),
      },
    ];
    return [
      { source: "/:path*", headers: seguridad },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
