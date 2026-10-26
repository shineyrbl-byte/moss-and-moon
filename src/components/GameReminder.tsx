"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { toUtcMin } from "@/lib/reminderTime";

const KEY = "mm-game-reminder";
const TIMES = [...Array(17).keys()].map((k) => `${String(k + 6).padStart(2, "0")}:00`); // 6am to 10pm
const nice = (t: string) => { const h = +t.slice(0, 2); return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`; };
const toKey = (base64: string) => {
  const raw = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** "Remind me to play": one push notification a day at the time you pick, skipped if you've already played */
export default function GameReminder() {
  const { toast } = useStore();
  const [time, setTime] = useState("08:00");
  const [on, setOn] = useState<{ time: string; endpoint: string } | null>(null);
  const [state, setState] = useState<"ready" | "busy" | "blocked" | "unsupported" | "ios">("ready");
  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!supported) return setState(ios && !standalone ? "ios" : "unsupported");
    if (Notification.permission === "denied") setState("blocked");
    try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (v?.endpoint) { setOn(v); setTime(v.time); } } catch {}
  }, []);
  async function turnOn(t = time) {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "ready");
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      const r = await fetch("/api/game-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), atMin: toUtcMin(t, new Date().getTimezoneOffset()), voter: voterId() }) });
      if (!r.ok) throw new Error((await r.json()).error);
      const v = { time: t, endpoint: sub.endpoint };
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
      setOn(v); setState("ready"); toast(`🔔 We'll remind you at ${nice(t)} each day`);
    } catch (e) { console.warn(e); setState("ready"); toast("Couldn't turn on reminders on this browser."); }
  }
  async function turnOff() {
    if (!on) return;
    await fetch("/api/game-reminder", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: on.endpoint }) }).catch(() => {});
    try { localStorage.removeItem(KEY); } catch {}
    setOn(null); toast("Reminders off");
  }
  return (
    <section className="card" id="reminder" style={{ padding: "1rem 1.1rem", margin: "1rem 0" }}>
      <h2 className="h3" style={{ marginTop: 0 }}>🔔 Daily reminder</h2>
      <p className="small muted">A notification once a day when it&apos;s puzzle time. If you&apos;ve already saved a score that day, we skip it. Off unless you turn it on.</p>
      {state === "unsupported" ? <p className="small muted">This browser can&apos;t do notifications.</p>
        : state === "ios" ? <p className="small muted">📲 On iPhone, add this site to your Home Screen first, then turn reminders on from there.</p>
        : state === "blocked" ? <p className="small muted">🔕 Notifications are blocked for this site. You can allow them in your browser settings.</p>
        : (
          <div className="row" style={{ gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
            <label className="field" style={{ margin: 0 }}>Remind me at
              <select className="input" value={time} onChange={(e) => { setTime(e.target.value); if (on) void turnOn(e.target.value); }}>
                {TIMES.map((t) => <option key={t} value={t}>{nice(t)}</option>)}
              </select>
            </label>
            {on ? <button className="btn btn-ghost btn-sm" onClick={turnOff}>Turn off</button>
              : <button className="btn btn-pink btn-sm" onClick={() => turnOn()} disabled={state === "busy"}>{state === "busy" ? "One sec…" : "Turn on"}</button>}
          </div>
        )}
      {on && <p className="small success" style={{ marginBottom: 0 }}>On: every day at {nice(on.time)}.</p>}
    </section>
  );
}
