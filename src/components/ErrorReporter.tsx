"use client";
import { useEffect } from "react";

/** Sends errors that happen in visitors' browsers to the café's error log */
export function reportBrowserError(message: string, stack = "") {
  try {
    const body = JSON.stringify({ message, stack, url: window.location.pathname });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/errors", new Blob([body], { type: "application/json" }));
    else void fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch {}
}

export default function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    const once = (msg: string, stack?: string) => {
      if (seen.has(msg) || seen.size > 5) return;
      seen.add(msg);
      reportBrowserError(msg, stack);
    };
    const onError = (e: ErrorEvent) => once(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => once(e.reason instanceof Error ? e.reason.message : String(e.reason), e.reason?.stack);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
