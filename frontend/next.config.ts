import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: {
    root: frontendDir,
  },
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
