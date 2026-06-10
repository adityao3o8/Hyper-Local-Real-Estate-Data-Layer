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
  // Bundle the JSON datasets with the serverless functions on Vercel.
  // Without this, `data/raw/*.json` is excluded from the function's file
  // trace and `fs.readFile` will 404 at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**"],
  },
};

export default nextConfig;
