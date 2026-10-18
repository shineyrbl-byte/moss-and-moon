"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import { hourText, type DayHours } from "@/lib/cafe";
import { happyHourLabel, type HappyHour } from "@/lib/pricing";
import type { Category } from "@/lib/menu";

type Config = { hours: Record<number, DayHours>; closures: { date: string; note: string }[]; happyHour: HappyHour };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const CATS: { id: Category; label: string }[] = [{ id: "coffee", label: "Coffee" }, { id: "tea", label: "Tea" }, { id: "cold", label: "Cold drinks" }, { id: "food", label: "Food" }, { id: "bakes", label: "Bakes" }, { id: "shop", label: "Shop" }];
const HOURS = Array.from({ length: 25 }, (_, i) => i);

/** Owner: opening hours, holiday closures and golden hour */
export default function HoursEditor() {
  const { toast } = useStore();
  const [c, setC] = useState<Config | null>(null);
  const [saved, setSaved] = useState("");
  const [closure, setClosure] = useState({ date: "", note: "" });
  const [clash, setClash] = useState<{ code: string; name: string; date: string; time: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/cafe-config").then((r) => r.json()).then((d) => { setC(d); setSaved(JSON.stringify(d)); }).catch(() => {});
  }, []);
  if (!c) return null;
  const dirty = JSON.stringify(c) !== saved;

  async function save() {
    // Branches are saved by their own card, so leave them out here
    const r = await fetch("/api/admin/cafe-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, branches: undefined }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    const { clashingBookings, ...rest } = d;
    setC(rest);
    setSaved(JSON.stringify(rest));
    setClash(clashingBookings ?? []);
    toast("Saved ✓ The site uses the new hours straight away.");
  }
  const setDay = (d: number, v: DayHours) => setC({ ...c, hours: { ...c.hours, [d]: v } });
  const hh = c.happyHour;
  const setHH = (patch: Partial<HappyHour>) => setC({ ...c, happyHour: { ...hh, ...patch } });

  return (
    <section className="card" style={{ padding: "1.2rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.3rem" }}>🕰 Hours, holidays & golden hour</h3>
        <button className="btn btn-pink btn-sm" onClick={save} disabled={!dirty}>{dirty ? "Save changes" : "Saved"}</button>
      </div>

      <div className="hours-grid">
        {ORDER.map((d) => {
          const h = c.hours[d];
          return (
            <div key={d} className="hours-row">
              <b>{DAYS[d]}</b>
              {h ? (
                <span className="row" style={{ gap: "0.35rem", alignItems: "center" }}>
                  <select className="input" value={h[0]} onChange={(e) => setDay(d, [Number(e.target.value), h[1]])} aria-label={`${DAYS[d]} opens`}>
                    {HOURS.slice(0, 24).map((x) => <option key={x} value={x}>{hourText(x)}</option>)}
                  </select>
                  <span className="muted">to</span>
                  <select className="input" value={h[1]} onChange={(e) => setDay(d, [h[0], Number(e.target.value)])} aria-label={`${DAYS[d]} closes`}>
                    {HOURS.slice(1).map((x) => <option key={x} value={x}>{hourText(x)}</option>)}
                  </select>
                </span>
              ) : (
                <span className="muted">Closed</span>
              )}
              <button className="link-btn small" onClick={() => setDay(d, h ? null : [9, 18])}>{h ? "Close this day" : "Open this day"}</button>
            </div>
          );
        })}
      </div>

      <div>
        <b className="small">Holidays & closures</b>
        <ul className="backup-list" style={{ marginTop: "0.4rem" }}>
          {c.closures.map((x) => (
            <li key={x.date}>
              <span>{new Date(x.date + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}{x.note ? ` · ${x.note}` : ""}</span>
              <span />
              <button className="link-btn" onClick={() => setC({ ...c, closures: c.closures.filter((y) => y.date !== x.date) })}>Remove</button>
            </li>
          ))}
          {!c.closures.length && <li className="muted small"><span>No closures planned.</span><span /><span /></li>}
        </ul>
        <form className="row" style={{ marginTop: "0.5rem" }} onSubmit={(e) => {
          e.preventDefault();
          if (!closure.date) return;
          setC({ ...c, closures: [...c.closures.filter((y) => y.date !== closure.date), closure].sort((a, b) => a.date.localeCompare(b.date)) });
          setClosure({ date: "", note: "" });
        }}>
          <input className="input" type="date" required value={closure.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setClosure({ ...closure, date: e.target.value })} aria-label="Closed on" style={{ maxWidth: 180 }} />
          <input className="input" placeholder="Why? e.g. Diwali, deep clean" maxLength={60} value={closure.note} onChange={(e) => setClosure({ ...closure, note: e.target.value })} aria-label="Reason" style={{ flex: 1, minWidth: 160 }} />
          <button className="btn btn-ghost btn-sm">Add closure</button>
        </form>
        <p className="tiny muted">On closed days guests can&apos;t order or book, and the site says when you&apos;re back.</p>
      </div>

      {clash.length > 0 && (
        <div className="reward-banner" role="alert">
          ⚠️ {clash.length} booking{clash.length === 1 ? "" : "s"} fall on closed days: {clash.map((b) => `${b.name} (${b.date} ${b.time}, ${b.code})`).join(", ")}. Let them know, or cancel them in Bookings.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div className="toggle-row">
          <b className="small">✨ Golden hour</b>
          <button className={`switch ${hh.on ? "" : "off"}`} onClick={() => setHH({ on: !hh.on })} aria-pressed={hh.on} aria-label="Golden hour on" />
        </div>
        {hh.on && (
          <>
            <div className="row" style={{ alignItems: "center", gap: "0.4rem" }}>
              <select className="input" style={{ width: "auto" }} value={hh.from} onChange={(e) => setHH({ from: Number(e.target.value) })} aria-label="Golden hour starts">
                {HOURS.slice(0, 24).map((x) => <option key={x} value={x}>{hourText(x)}</option>)}
              </select>
              <span className="muted">to</span>
              <select className="input" style={{ width: "auto" }} value={hh.to} onChange={(e) => setHH({ to: Number(e.target.value) })} aria-label="Golden hour ends">
                {HOURS.slice(1).map((x) => <option key={x} value={x}>{hourText(x)}</option>)}
              </select>
              <input className="input" type="number" min={1} max={90} style={{ width: "5rem" }} value={Math.round(hh.off * 100)} onChange={(e) => setHH({ off: Math.max(0.01, Math.min(0.9, Number(e.target.value) / 100)) })} aria-label="Discount percent" />
              <span className="muted">% off</span>
            </div>
            <div className="chips" style={{ justifyContent: "flex-start" }}>
              {CATS.map((k) => {
                const on = hh.cats.includes(k.id);
                return <button key={k.id} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setHH({ cats: on ? hh.cats.filter((x) => x !== k.id) : [...hh.cats, k.id] })}>{k.label}</button>;
              })}
            </div>
            <div className="chips" style={{ justifyContent: "flex-start" }}>
              {ORDER.map((d) => {
                const on = hh.days.includes(d);
                return <button key={d} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setHH({ days: on ? hh.days.filter((x) => x !== d) : [...hh.days, d] })}>{DAYS[d].slice(0, 3)}</button>;
              })}
            </div>
            <p className="small muted">Guests see: “{happyHourLabel(hh)}”</p>
          </>
        )}
      </div>
    </section>
  );
}
