"use client";
import { useEffect, useState } from "react";
import { addFlag } from "@/lib/trophyFlags";

type T = { date: string; spot: { id: number; photo: string; options: string[] } | null };
const SAVE = "mm-goa";

export default function WhereInGoa() {
  const [t, setT] = useState<T | null>(null);
  const [res, setRes] = useState<{ pick: string; right: boolean; answer: string; note: string } | null>(null);
  const [rec, setRec] = useState({ streak: 0, best: 0, last: "" });
  useEffect(() => {
    fetch("/api/goa-spots").then((r) => r.json()).then((d: T) => {
      setT(d);
      try { const v = JSON.parse(localStorage.getItem(SAVE) ?? "null"); if (v) { setRec(v); if (v.last === d.date && v.res) setRes(v.res); } } catch {}
    }).catch(() => {});
  }, []);
  async function guess(pick: string) {
    if (!t?.spot || res) return;
    const r = await fetch("/api/goa-spots/guess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.spot.id, guess: pick }) }).then((x) => x.json());
    if (r.error) return;
    const out = { pick, right: r.right, answer: r.answer, note: r.note };
    const streak = r.right ? rec.streak + 1 : 0, next = { streak, best: Math.max(rec.best, streak), last: t.date, res: out };
    if (streak >= 5) addFlag("goa-five");
    setRes(out); setRec(next); try { localStorage.setItem(SAVE, JSON.stringify(next)); } catch {}
  }
  if (!t) return <div className="page"><p className="muted">Looking out of the window…</p></div>;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily guess</p>
      <h1 className="h2">Where in <em>Goa?</em></h1>
      <p className="small muted">One photo a day of somewhere in Goa, from the café team. Where was it taken? Four choices, one go.</p>
      {!t.spot ? <p className="card" style={{ padding: "1rem" }}>No photos yet. The team adds them, so check back soon ☀️</p> : (
        <>
          <p className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Streak <b>{rec.streak}</b></span><span>Best <b>{rec.best}</b></span></p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.spot.photo} alt="Today's photo of a place in Goa" style={{ width: "100%", borderRadius: 16, aspectRatio: "4 / 3", objectFit: "cover" }} />
          <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.8rem" }}>
            {t.spot.options.map((o) => (
              <button key={o} className={`btn ${res ? (o === res.answer ? "btn-pink" : o === res.pick ? "btn-ghost" : "btn-ghost") : "btn-ghost"}`} style={res && o === res.pick && !res.right ? { textDecoration: "line-through" } : undefined} onClick={() => guess(o)} disabled={!!res} aria-pressed={res?.pick === o}>
                {res && o === res.answer ? "✓ " : ""}{o}
              </button>
            ))}
          </div>
          {res && <p className="center" role="status" style={{ marginTop: "0.8rem" }}><b>{res.right ? "Spot on! 🌴" : `It's ${res.answer}.`}</b>{res.note ? <><br /><span className="small muted">{res.note}</span></> : null}<br /><span className="tiny muted">A new photo tomorrow.</span></p>}
        </>
      )}
    </div>
  );
}
