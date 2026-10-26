"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddToCalendar from "@/components/AddToCalendar";
import { monthNights, nextFullMoons, PHASE_LABEL } from "@/lib/moonCalendar";
import { shiftMonth, monthLabel } from "@/lib/comeback";
import { toDateStr } from "@/lib/cafe";

const time = (ms: number) => new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MoonCalendar() {
  const [today, setToday] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  useEffect(() => { const d = toDateStr(new Date()); setToday(d); setMonth(d.slice(0, 7)); }, []);
  const nights = useMemo(() => (month ? monthNights(month) : []), [month]);
  const fulls = useMemo(() => (today ? nextFullMoons(new Date(), 12) : []), [today]);
  if (!today) return <div className="page narrow" />;
  const lead = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7; // blank days before the 1st (weeks start Monday)
  return (
    <div className="page" style={{ maxWidth: "46rem" }}>
      <p className="eyebrow">the moon in moss &amp; moon</p>
      <h1 className="h2">Moon <em>calendar</em></h1>
      <p className="lead">Every night&apos;s moon, worked out for India. Around each full moon we pour the <b>Full Moon Cortado</b> 🌕, and the <Link href="/wish-tree">wish tree</Link> lets its wishes go.</p>
      <div className="moon-month-head">
        <button className="chip" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">←</button>
        <h2 className="h3" style={{ margin: 0 }}>{monthLabel(month)}</h2>
        <button className="chip" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">→</button>
      </div>
      <div className="moon-grid" role="grid" aria-label={`Moon phases in ${monthLabel(month)}`}>
        {WEEKDAYS.map((d) => <span key={d} className="moon-wd" role="columnheader">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} aria-hidden="true" />)}
        {nights.map((n) => (
          <span key={n.date} role="gridcell" className={`moon-day ${n.date === today ? "today" : ""} ${n.cortado ? "cortado" : ""} ${n.phase === "full" ? "full" : ""}`} aria-label={`${n.date.slice(8)}: ${PHASE_LABEL[n.phase]}${n.cortado ? ", Full Moon Cortado night" : ""}`}>
            <span className="moon-num">{Number(n.date.slice(8))}</span>
            <span className="moon-ic" aria-hidden="true">{n.icon}</span>
          </span>
        ))}
      </div>
      <p className="tiny muted"><span className="moon-key cortado" /> Full Moon Cortado nights · phases shown at 9pm</p>

      <h2 className="h3" style={{ marginTop: "1.6rem" }}>The next full moons</h2>
      <ul className="moon-list">
        {fulls.map((f) => (
          <li key={f.at} className="card">
            <span><b>🌕 {new Date(`${f.night}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</b><br /><span className="tiny muted">exactly full {time(f.at)}</span></span>
            <AddToCalendar event={{ uid: `fullmoon-${f.night}`, title: "🌕 Full moon at Moss & Moon", date: f.night, time: "19:00", minutes: 180, location: "Moss & Moon", details: "Full Moon Cortado night. Exactly full at " + time(f.at) + " (India time)." }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
