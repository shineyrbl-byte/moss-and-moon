"use client";
import { useEffect, useState } from "react";

const toKey = (base64: string) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// "Notify me when it's ready": a real push notification, even if this tab is closed.
export default function NotifyButton({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "busy" | "on" | "blocked" | "unsupported" | "ios">("idle");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!supported) return setState(ios && !standalone ? "ios" : "unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    try {
      if ((JSON.parse(localStorage.getItem("mm-notify") || "[]") as string[]).includes(code)) setState("on");
    } catch {}
  }, [code]);

  async function enable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "idle");
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, subscription: sub.toJSON() }) });
      if (!r.ok) throw new Error("save failed");
      try {
        const list = JSON.parse(localStorage.getItem("mm-notify") || "[]") as string[];
        localStorage.setItem("mm-notify", JSON.stringify([...list, code].slice(-20)));
      } catch {}
      setState("on");
    } catch (e) {
      console.warn(e);
      setState("idle");
    }
  }

  if (state === "unsupported") return null;
  if (state === "ios") return <p className="small muted">📲 On iPhone, add this site to your Home Screen to get a ping when it&apos;s ready.</p>;
  if (state === "blocked") return <p className="small muted">🔕 Notifications are blocked for this site. You can turn them on in your browser settings.</p>;
  if (state === "on") return <p className="small success">🔔 We&apos;ll send a notification the moment it&apos;s ready.</p>;
  return (
    <button className="btn btn-ghost btn-sm" onClick={enable} disabled={state === "busy"}>
      {state === "busy" ? "One sec…" : "🔔 Notify me when it's ready"}
    </button>
  );
}
