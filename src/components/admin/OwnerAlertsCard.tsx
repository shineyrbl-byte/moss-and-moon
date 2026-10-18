"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type D = { kinds: { id: string; label: string }[]; prefs: Record<string, boolean>; devices: number; publicKey: string };
const toKey = (base64: string) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const post = (body: object) => fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Owner, Settings: alerts on your phone (works even with the site closed) */
export default function OwnerAlertsCard() {
  const { toast } = useStore();
  const [d, setD] = useState<D | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    fetch("/api/admin/alerts").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!("PushManager" in window)) setNote(ios && !standalone ? "On iPhone, add this site to your Home Screen first (Share → Add to Home Screen), then open it from there." : "This browser can't receive alerts. Try Chrome on Android, or Safari from the Home Screen on iPhone.");
  }, []);
  if (!d) return null;
  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast("Notifications weren't allowed. You can change that in the browser's site settings."); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(d!.publicKey) }));
      const r = await post({ subscription: sub.toJSON(), test: true });
      if (!r.ok) throw new Error();
      setD({ ...d!, ...(await r.json()) });
      toast("Alerts on for this device 🔔 A test alert is on its way");
    } catch {
      toast("Couldn't turn on alerts here. Try again?");
    } finally {
      setBusy(false);
    }
  }
  async function setPref(id: string, on: boolean) {
    const r = await post({ prefs: { [id]: on } });
    if (r.ok) setD({ ...d!, ...(await r.json()) });
  }
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
      <h3 style={{ fontSize: "1.2rem" }}>🔔 Alerts on your phone</h3>
      <p className="small muted">Hear about problems straight away, even with the site closed. {d.devices ? `On for ${d.devices} device${d.devices === 1 ? "" : "s"}.` : "Turn it on from the phone you want them on."}</p>
      {note ? <p className="small">{note}</p> : <button className="btn btn-pink btn-sm" disabled={busy} onClick={enable}>{busy ? "One sec…" : d.devices ? "Add this device too" : "Turn on alerts here"}</button>}
      <ul className="check-list">
        {d.kinds.map((k) => (
          <li key={k.id}>
            <span style={{ flex: 1 }}>{k.label}</span>
            <button className={`switch ${d.prefs[k.id] ? "" : "off"}`} onClick={() => setPref(k.id, !d.prefs[k.id])} aria-pressed={d.prefs[k.id]} aria-label={k.label} />
          </li>
        ))}
      </ul>
      {d.devices > 0 && <button className="link-btn small" onClick={async () => { const r = await post({ forget: true }); if (r.ok) setD({ ...d, ...(await r.json()) }); toast("Alerts off on all devices"); }}>Stop alerts on all devices</button>}
    </section>
  );
}
