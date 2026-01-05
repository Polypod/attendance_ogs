// frontend/src/proxy.ts - Route protection proxy
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function proxy(req) {
    // Proxy logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"]
};
