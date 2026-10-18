"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "./Store";
import { HOURS } from "@/lib/cafe";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
type S = { id: number; days: number[]; time: string; active: boolean; skipDate: string | null; lastOrder: string | null; summary: string; next: string | null };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fmt = (t: string) => { const h = Number(t.slice(0, 2)); return `${h % 12 || 12}:${t.slice(3)}${h >= 12 ? "pm" : "am"}`; };
const dayName = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Pickup times that work on at least one day */
const TIMES = (() => {
  const earliest = Math.min(...Object.values(HOURS).map(([o]) => o));
  const latest = Math.max(...Object.values(HOURS).map(([, c]) => c));
  const out: string[] = [];
  for (let m = earliest * 60 + 15; m <= latest * 60 - 15; m += 15) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
})();

/** "Make it a regular" form: used on the order page with that order's items */
export function MakeRegular({ lines, onDone }: { lines: { itemId: string; opts: object; qty: number }[]; onDone?: () => void }) {
  const { toast, me } = useStore();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [time, setTime] = useState("08:30");
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  if (!open) return <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>🔁 Make it a regular</button>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/account/schedules", json("POST", { lines, days, time }));
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    toast(`Done! We'll have it ready at ${fmt(time)} ✿`);
    setOpen(false);
    onDone?.();
  }
  return (
    <form className="card regular-form" onSubmit={save}>
      <strong>🔁 Have this ready for me every…</strong>
      <div className="chips" style={{ justifyContent: "flex-start" }}>
        {ORDER.map((d) => (
          <button type="button" key={d} className={`chip ${days.includes(d) ? "on" : ""}`} aria-pressed={days.includes(d)} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>{DAYS[d]}</button>
        ))}
      </div>
      <label className="row small" style={{ alignItems: "center", gap: "0.5rem" }}>at
        <select className="input" style={{ width: "auto" }} value={time} onChange={(e) => setTime(e.target.value)}>
          {TIMES.map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
        </select>
      </label>
      <p className="small muted">We place it 15 minutes before, so it&apos;s fresh when you arrive. You pay at the counter, and can pause or skip a day any time from your account.</p>
      <div className="row">
        <button className="btn btn-pink btn-sm" disabled={busy || !days.length}>{busy ? "Saving…" : "Save my regular"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** Account page: your regular orders, with pause / skip / remove */
export default function RegularOrders() {
  const { toast } = useStore();
  const [list, setList] = useState<S[] | null>(null);
  const load = useCallback(() => fetch("/api/account/schedules").then((r) => (r.ok ? r.json() : [])).then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function act(method: "PATCH" | "DELETE", body: object, msg: string) {
    const r = await fetch("/api/account/schedules", json(method, body));
    if (!r.ok) return toast((await r.json()).error);
    toast(msg);
    load();
  }
  if (!list) return null;
  return (
    <div className="card account-card" style={{ marginTop: "1.2rem" }}>
      <h3>🔁 Regular orders</h3>
      {!list.length && <p className="small muted">Order something you love, then tap <b>“Make it a regular”</b> on the order page to have it ready on the days you choose.</p>}
      {list.map((s) => (
        <div key={s.id} className="regular-row">
          <div>
            <b>{s.summary}</b>
            <p className="small muted">
              {ORDER.filter((d) => s.days.includes(d)).map((d) => DAYS[d]).join(", ")} at {fmt(s.time)}
              {" · "}{s.active ? (s.next ? `next: ${dayName(s.next)}` : "no upcoming day") : "paused"}
            </p>
          </div>
          <div className="row" style={{ gap: "0.4rem" }}>
            {s.active && s.next && <button className="btn btn-ghost btn-sm" onClick={() => act("PATCH", { id: s.id, skip: s.next }, `Skipping ${dayName(s.next!)} ✓`)}>Skip {dayName(s.next)}</button>}
            {s.skipDate && <button className="btn btn-ghost btn-sm" onClick={() => act("PATCH", { id: s.id, skip: null }, "Un-skipped ✓")}>Undo skip</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => act("PATCH", { id: s.id, active: !s.active }, s.active ? "Paused" : "Back on ✿")}>{s.active ? "Pause" : "Resume"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => act("DELETE", { id: s.id }, "Removed")} aria-label="Remove this regular order">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
