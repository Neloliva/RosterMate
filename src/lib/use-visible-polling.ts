"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Calls router.refresh() on an interval while the tab is visible. Stops when
// the tab is hidden so we don't keep re-rendering server components in the
// background. This is the pragmatic stand-in for realtime push — good enough
// for a small-team rostering app without the WebSocket infrastructure.
export function useVisiblePolling(intervalMs: number) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        router.refresh();
      }, intervalMs);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, router]);
}
