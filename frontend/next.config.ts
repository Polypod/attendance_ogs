import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API proxying is implemented via the App Router catch-all route:
  // `src/app/api/[...path]/route.ts`.
  // This keeps the backend destination runtime-configurable via BACKEND_URL,
  // instead of baking it into build artifacts via rewrites.
};

export default nextConfig;
