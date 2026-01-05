// frontend/src/middleware.ts - Route protection middleware
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*"]
};
