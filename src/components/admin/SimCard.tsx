"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type S = { on: boolean; until: string; speed: "calm" | "busy" | "rush"; orders: number };
const SPEEDS = [{ id: "calm", label: "Calm", note: "about 1 order a minute" }, { id: "busy", label: "Busy", note: "about 3 a minute" }, { id: "rush", label: "Rush hour", note: "about 6 a minute" }] as const;

/** Owner, Settings: pretend guests order on their own, so every screen comes alive */
export default function SimCard() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [speed, setSpeed] = useState<S["speed"]>("busy");
  const [minutes, setMinutes] = useState(30);
  const load = () => fetch("/api/admin/sim").then((r) => (r.ok ? r.json() : null)).then((x) => x && setS(x)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, []);
  if (!s) return null;
  async function act(body: Record<string, unknown>, msg: string) {
    const r = await fetch("/api/admin/sim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) return toast(d.error ?? "That didn't work.");
    setS(d);
    toast(d.cleared !== undefined ? `Cleared ${d.cleared} simulated order${d.cleared === 1 ? "" : "s"}` : msg);
  }
  const until = s.on ? new Date(s.until).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
      <h3 style={{ fontSize: "1.2rem" }}>🎭 A day in the life</h3>
      <p className="small muted">Pretend guests place orders on their own (pick up, tables, delivery, Swiggy and Zomato), and their orders move through brewing and ready like a real barista is working. Open the barista screen, kitchen display or TV board to watch. Simulated orders are marked 🎭 and can be cleared any time.</p>
      {s.on ? (
        <p className="reward-banner small">▶︎ Running until {until}, {SPEEDS.find((x) => x.id === s.speed)?.label.toLowerCase()} · {s.orders} simulated order{s.orders === 1 ? "" : "s"} so far</p>
      ) : s.orders > 0 ? <p className="small muted">{s.orders} simulated order{s.orders === 1 ? "" : "s"} still in the system.</p> : null}
      {!s.on && (
        <div className="row" style={{ alignItems: "flex-end", gap: "0.8rem", flexWrap: "wrap" }}>
          <div className="chips" role="radiogroup" aria-label="How busy" style={{ justifyContent: "flex-start" }}>
            {SPEEDS.map((x) => <button key={x.id} type="button" role="radio" aria-checked={speed === x.id} title={x.note} className={`chip ${speed === x.id ? "on" : ""}`} onClick={() => setSpeed(x.id)}>{x.label}</button>)}
          </div>
          <label className="field small" style={{ maxWidth: 140 }}>For
            <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[15, 30, 60, 120].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? "s" : ""}`}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="row" style={{ gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
        {s.on ? <button className="btn btn-ghost btn-sm" onClick={() => act({ action: "stop" }, "Stopped. Orders already in finish on their own.")}>⏸ Stop</button>
          : <button className="btn btn-pink btn-sm" onClick={() => act({ action: "start", minutes, speed }, "Started ✿ Open the barista screen to watch")}>▶︎ Start</button>}
        {s.orders > 0 && <button className="btn btn-ghost btn-sm" onClick={() => act({ action: "clear" }, "")}>🧹 Clear simulated orders</button>}
        <a className="btn btn-ghost btn-sm" href="/staff" target="_blank" rel="noreferrer">Open barista screen ↗</a>
      </div>
    </section>
  );
}
