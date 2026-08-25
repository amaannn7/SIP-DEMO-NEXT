"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const PING_INTERVAL_MS = 60_000;
const IDLE_THRESHOLD_MS = 60_000;

/**
 * Ports the source system's activity heartbeat: pings every 60s with the
 * current page, but skips the ping if the user has been idle (no
 * mouse/keyboard/scroll activity) for over 60s — powers the admin "online
 * now / last seen / last page" session widget without pinging for a tab
 * left open and unattended.
 */
export function ActivityHeartbeat() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const lastInteractionRef = useRef(Date.now());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const markActive = () => {
      lastInteractionRef.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > IDLE_THRESHOLD_MS) return;
      fetch("/api/activity-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pathnameRef.current }),
      }).catch(() => {});
    }, PING_INTERVAL_MS);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActive));
      clearInterval(interval);
    };
  }, []);

  return null;
}
