"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { istClock, sunDay } from "@/lib/sun";
import { toDateStr } from "@/lib/cafe";
import { defaultOptions } from "@/lib/pricing";
import { itemName } from "@/lib/menu";
import type { Spot } from "@/lib/nearby";

const ampm = (ms: number) => { const [h, m] = istClock(ms).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
function until(ms: number, now: number) {
  const m = Math.round((ms - now) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export default function Sunset() {
  const { menu, lang, add, toast, setDrawerOpen } = useStore();
  const [now, setNow] = useState<number | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useEffect(() => { fetch("/api/nearby").then((r) => r.json()).then((d) => setSpots((d.spots ?? []).filter((s: Spot) => s.kind === "sunset" || s.kind === "beach"))).catch(() => {}); }, []);
  if (now === null) return <div className="page narrow" />;
  const today = toDateStr(new Date(now));
  let s = sunDay(today), day = today;
  if (now > s.dusk) { day = addDays(today, 1); s = sunDay(day); } // after dark: tomorrow's
  const phase = now < s.goldenStart ? "before" : now < s.sunset ? "golden" : "blue";
  const drink = menu.find((m) => m.id === "cold-brew" && !m.soldOut) ?? menu.find((m) => m.cat === "cold" && !m.soldOut && !m.pup);
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i); return { d, ...sunDay(d) }; });
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">{day === today ? "tonight" : "tomorrow"} in Panjim</p>
      <h1 className="h2">Sunset <em>tracker</em></h1>
      <section className={`card sunset-card ${phase}`} aria-live="polite">
        <span className="sunset-sun" aria-hidden="true">{phase === "blue" ? "🌆" : "🌅"}</span>
        <p className="sunset-time"><span className="small">Sunset</span><b>{ampm(s.sunset)}</b></p>
        <p className="sunset-status">
          {phase === "before" && <>Golden hour starts in <b>{until(s.goldenStart, now)}</b></>}
          {phase === "golden" && <>✨ It&apos;s golden hour now. Sunset in <b>{until(s.sunset, now)}</b></>}
          {phase === "blue" && <>The sun&apos;s down. Blue hour until <b>{ampm(s.dusk)}</b></>}
        </p>
        <dl className="sunset-facts">
          <div><dt>Golden hour</dt><dd>{ampm(s.goldenStart)}</dd></div>
          <div><dt>Sunset</dt><dd>{ampm(s.sunset)}</dd></div>
          <div><dt>Last light</dt><dd>{ampm(s.dusk)}</dd></div>
        </dl>
        {drink && <button className="btn btn-pink btn-sm" onClick={() => { add(drink.id, defaultOptions(drink), 1); toast(`${itemName(drink, lang)} added 🌅`); setDrawerOpen(true); }}>Take a {itemName(drink, lang)} for the walk</button>}
      </section>
      {spots.length > 0 && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Where to watch it</h2>
          <ul className="sunset-spots">
            {spots.map((sp) => <li key={sp.id}><b>{sp.name}</b> <span className="muted small">· 🚶 {sp.walk_min} min · leave by {ampm(s.sunset - (sp.walk_min + 10) * 60000)}</span></li>)}
          </ul>
          <p className="small"><Link href="/nearby">More places around the corner →</Link></p>
        </section>
      )}
      <h2 className="h3" style={{ marginTop: "1.4rem" }}>This week</h2>
      <table className="sunset-week">
        <thead><tr><th scope="col">Day</th><th scope="col">Sunrise</th><th scope="col">Golden hour</th><th scope="col">Sunset</th></tr></thead>
        <tbody>{week.map((w) => <tr key={w.d}><th scope="row">{new Date(`${w.d}T12:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</th><td>{ampm(w.sunrise)}</td><td>{ampm(w.goldenStart)}</td><td><b>{ampm(w.sunset)}</b></td></tr>)}</tbody>
      </table>
      <p className="tiny muted">Worked out for Panjim, to within a couple of minutes. Clouds not included.</p>
    </div>
  );
}
