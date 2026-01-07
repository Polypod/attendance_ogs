"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    function handleError(e: any) {
      const msg = e?.message || (e?.error && e.error.message) || (e?.reason && e.reason.message) || '';
      const scriptSrc = e?.target?.src || e?.filename || '';

      // Detect chunk load failures (common pattern when new deploy happens while client still running)
      const isChunkLoadError = /loading chunk|chunkloaderror|failed to load chunk/i.test(msg) || /_next\/static\/chunks\//i.test(scriptSrc);
      if (isChunkLoadError) {
        console.warn('Chunk load failed, reloading to fetch new assets.');
        // Force full reload to pick up latest build
        window.location.reload();
      }
    }

    const onUnhandledRejection = (ev: any) => {
      const reason = ev?.reason;
      const msg = reason?.message || reason || '';
      if (/loading chunk|chunkloaderror/i.test(String(msg))) {
        console.warn('Unhandled rejection caused by chunk load failure, reloading.');
        window.location.reload();
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
