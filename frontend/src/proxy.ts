// frontend/src/proxy.ts - Route protection proxy
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function proxy(_req) {
    // Proxy logic here if needed
  },
  {
    callbacks: {
      // A session whose access token could not be renewed (for example an
      // OGS role that was removed) no longer opens the dashboard.
      authorized: ({ token }) => !!token && !token.error,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"]
};
