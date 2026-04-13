"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockAtRef = useRef<number>(0);

  // On mount: ask the server if this IP is currently rate limited
  useEffect(() => {
    fetch("/api/auth/rate-limit-status")
      .then((r) => r.json())
      .then((data) => {
        if (data.rateLimited && data.resetAt) {
          const unlockAt = data.resetAt * 1000;
          const remaining = Math.ceil((unlockAt - Date.now()) / 1000);
          if (remaining > 0) {
            unlockAtRef.current = unlockAt;
            setRateLimitSecondsLeft(remaining);
            setError("Too many login attempts. Please try again later after 15 minutes.");
            startCountdown(unlockAt);
          }
        }
      })
      .catch(() => {});
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCountdown = (unlockAt: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000));
      setRateLimitSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current!);
        setError("");
      }
    }, 1000);
  };

  const startRateLimitTimer = (resetHeader: string | null) => {
    let unlockAt: number;
    if (resetHeader) {
      unlockAt = parseInt(resetHeader, 10) * 1000;
      if (isNaN(unlockAt) || unlockAt < Date.now()) {
        unlockAt = Date.now() + 15 * 60 * 1000;
      }
    } else {
      unlockAt = Date.now() + 15 * 60 * 1000;
    }
    unlockAtRef.current = unlockAt;
    setRateLimitSecondsLeft(Math.ceil((unlockAt - Date.now()) / 1000));
    startCountdown(unlockAt);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // First call server-side proxy to get real error messages (e.g. rate limit)
      const preCheck = await fetch("/api/auth/check-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const preData = await preCheck.json();

      if (!preCheck.ok || !preData.success) {
        setError(preData.message || "Invalid email or password");
        if (preCheck.status === 429) {
          startRateLimitTimer(preCheck.headers.get("RateLimit-Reset"));
        }
        return;
      }

      // Credentials are valid – establish NextAuth session
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        setError("An error occurred. Please try again.");
      } else if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Karate Attendance</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
              {rateLimitSecondsLeft > 0 && (
                <div className="mt-2 text-center font-mono text-lg font-bold">
                  {formatTime(rateLimitSecondsLeft)}
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@karateattendance.com"
              disabled={isLoading}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              disabled={isLoading}
              className="w-full"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || rateLimitSecondsLeft > 0}
            className="w-full"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Default admin credentials:</p>
          <p className="font-mono">admin@karateattendance.com / ChangeMe123!</p>
        </div>
      </Card>
    </div>
  );
}
