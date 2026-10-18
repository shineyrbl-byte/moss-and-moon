"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "./Store";

type R = { mode: "off" | "busy" | "paused"; until: number | null; extra: number; active: number; auto: boolean; autoBusy: boolean };
const t = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Staff: say it's busy (longer ready times) or pause online orders for a while */
export default function RushControl() {
  const { toast } = useStore();
  const [r, setR] = useState<R | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => fetch("/api/rush").then((x) => x.json()).then(setR).catch(() => {}), []);
  useEffect(() => { load(); const i = setInterval(load, 30_000); return () => clearInterval(i); }, [load]);
  if (!r) return null;
  async function set(body: object, msg: string) {
    const x = await fetch("/api/rush", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!x.ok) return toast((await x.json()).error);
    setR({ ...(await x.json()) });
    setOpen(false);
    toast(msg);
  }
  const label = r.mode === "paused" ? `⏸ Online orders paused${r.until ? ` till ${t(r.until)}` : ""}` : r.mode === "busy" ? `🚦 Busy (+${r.extra} min)${r.autoBusy ? " · auto" : ""}` : "🚦 Normal";
  return (
    <span className="rush">
      <button className={`chip ${r.mode !== "off" ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>{label}</button>
      {open && (
        <span className="rush-menu card" role="menu">
          <small className="muted">{r.active} order{r.active === 1 ? "" : "s"} in the queue</small>
          <button role="menuitem" onClick={() => set({ mode: "off" }, "Back to normal")}>Normal</button>
          <button role="menuitem" onClick={() => set({ mode: "busy", minutes: 60 }, "Ready times +10 min for the next hour")}>Busy: +10 min on ready times (1 hour)</button>
          <button role="menuitem" onClick={() => set({ mode: "paused", minutes: 15 }, "Online orders paused for 15 min")}>Pause online orders for 15 min</button>
          <button role="menuitem" onClick={() => set({ mode: "paused", minutes: 30 }, "Online orders paused for 30 min")}>Pause online orders for 30 min</button>
          <label className="row small" style={{ gap: "0.4rem", alignItems: "center", padding: "0.3rem 0.5rem" }}>
            <input type="checkbox" checked={r.auto} onChange={(e) => set({ mode: r.mode === "busy" && r.autoBusy ? "off" : r.mode, auto: e.target.checked, minutes: r.until ? Math.max(5, Math.round((r.until - Date.now()) / 60_000)) : undefined }, e.target.checked ? "Auto busy mode on" : "Auto busy mode off")} />
            Busy by itself at 12+ orders
          </label>
          <small className="muted" style={{ padding: "0 0.5rem" }}>Table QR and kiosk orders still work while paused.</small>
        </span>
      )}
    </span>
  );
}
