// frontend/src/hooks/useAuth.ts - Custom authentication hook
"use client";

import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    isAdmin: session?.user?.role === "admin",
    isInstructor: session?.user?.role === "instructor",
    isStaff: session?.user?.role === "staff",
    isStudent: session?.user?.role === "student"
  };
}
