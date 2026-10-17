"use client";
import { useEffect, useRef } from "react";

/** Calls onEvent whenever the server says something changed. Reconnects by itself. */
export function useLive(url: string | null, onEvent: (data: Record<string, unknown>) => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    if (!url || typeof EventSource === "undefined") return;
    const es = new EventSource(url);
    es.onmessage = (m) => {
      try { cb.current(JSON.parse(m.data)); } catch {}
    };
    return () => es.close();
  }, [url]);
}
