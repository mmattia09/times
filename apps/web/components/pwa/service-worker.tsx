"use client";

import { useEffect } from "react";

/** Registers the service worker in production (skipped in dev to avoid stale HMR assets). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration is a progressive enhancement — never surface a failure.
      });
    };

    // On a client-side navigation the load event has already fired, so waiting
    // for it would silently never register.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
