"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { logger } from "@/lib/logger";

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const reloadOnce = (reason: string) => {
      try {
        const key = "ogs_chunk_reload_once";
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, String(Date.now()));
      } catch {
        // ignore storage failures
      }
      logger.warn(reason);
      window.location.reload();
    };

    function handleError(e: any) {
      const msg = e?.message || (e?.error && e.error.message) || (e?.reason && e.reason.message) || '';
      const scriptSrc = e?.target?.src || e?.filename || '';

      // Detect chunk load failures (common pattern when new deploy happens while client still running)
      const isChunkLoadError =
        /loading chunk|chunkloaderror|failed to load chunk/i.test(msg) || /_next\/static\/chunks\//i.test(scriptSrc);
      if (isChunkLoadError) {
        // Force full reload to pick up latest build
        reloadOnce("chunk_load_failed_reload");
      }
    }

    const onUnhandledRejection = (ev: any) => {
      const reason = ev?.reason;
      const msg = reason?.message || reason || '';
      if (/loading chunk|chunkloaderror/i.test(String(msg))) {
        reloadOnce("chunk_load_failed_unhandled_rejection_reload");
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
