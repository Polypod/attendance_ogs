import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // API proxying is implemented via the App Router catch-all route:
  // `src/app/api/[...path]/route.ts`.
  // This keeps the backend destination runtime-configurable via BACKEND_URL,
  // instead of baking it into build artifacts via rewrites.
  turbopack: {
    // This repo has multiple lockfiles (root + frontend). Make the workspace root
    // explicit so Next.js doesn't need to infer it (and warn).
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
