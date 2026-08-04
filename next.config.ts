import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin esto la base no viaja con la función y el servidor arranca vacío.
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/radar-publico.db"],
  },
  /* config options here */
};

export default nextConfig;
