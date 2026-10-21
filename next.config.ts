import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Playwright (PDF export) loads its browser binaries at runtime and
  // can't be bundled.
  serverExternalPackages: ["playwright", "playwright-core"],
  experimental: {
    // Default server action body limit (1MB) is too small for Process Flow
    // Chart Excel imports — the reference workbook with its 83 embedded
    // sketch images is ~12MB.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
