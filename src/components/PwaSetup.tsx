"use client";
import { useEffect } from "react";

// Registers the service worker: makes the site installable, keeps the menu
// viewable offline, and receives "your order is ready" notifications.
export default function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker failed", e));
  }, []);
  return null;
}
