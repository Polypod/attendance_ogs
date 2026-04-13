import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000";

    return {
      afterFiles: [
        {
          source: "/api/config/:path*",
          destination: `${backendUrl}/api/config/:path*`,
        },
        {
          source: "/api/students/:path*",
          destination: `${backendUrl}/api/students/:path*`,
        },
        {
          source: "/api/classes/:path*",
          destination: `${backendUrl}/api/classes/:path*`,
        },
        {
          source: "/api/schedules/:path*",
          destination: `${backendUrl}/api/schedules/:path*`,
        },
        {
          source: "/api/attendance/:path*",
          destination: `${backendUrl}/api/attendance/:path*`,
        },
        {
          source: "/api/users/:path*",
          destination: `${backendUrl}/api/users/:path*`,
        },
        {
          source: "/api/reports/:path*",
          destination: `${backendUrl}/api/reports/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
