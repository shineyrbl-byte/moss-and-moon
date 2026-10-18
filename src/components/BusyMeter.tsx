"use client";
import { useEffect, useState } from "react";
import { BUSY_LABEL, busyLevel, hourLabel, type BusyLevel } from "@/lib/cafe";

type Busy = { open: boolean; level: BusyLevel | null; score: number; quietestHour: number | null; forecast: { hour: number; score: number }[]; basedOn: string };

function useBusy() {
  const [b, setB] = useState<Busy | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/busy").then((r) => r.json()).then(setB).catch(() => {});
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, []);
  return b;
}

/** Small "☕ Cosy right now" pill */
export function BusyBadge() {
  const b = useBusy();
  if (!b?.open || !b.level) return null;
  const l = BUSY_LABEL[b.level];
  return (
    <span className={`busy-pill busy-${b.level}`}>
      <span aria-hidden>{l.icon}</span> {l.text} right now
    </span>
  );
}

/** Pill + bars for each hour today, with the quietest time picked out */
export default function BusyMeter() {
  const b = useBusy();
  const [hover, setHover] = useState<number | null>(null);
  if (!b) return null;
  const nowH = new Date().getHours();
  const l = b.level ? BUSY_LABEL[b.level] : null;
  const shown = hover ?? null;

  return (
    <div className="busy card">
      <div className="busy-head">
        <strong>How busy is it?</strong>
        {l ? (
          <span className={`busy-pill busy-${b.level}`}><span aria-hidden>{l.icon}</span> {l.text} right now</span>
        ) : (
          <span className="busy-pill">Closed right now</span>
        )}
      </div>
      {b.quietestHour !== null && (
        <p className="small muted">🌿 Quietest time later today: <b>around {hourLabel(b.quietestHour)}</b></p>
      )}
      <div className="busy-bars" role="img" aria-label={`Expected busyness today: ${b.forecast.map((f) => `${hourLabel(f.hour)} ${BUSY_LABEL[busyLevel(f.score)].text.toLowerCase()}`).join(", ")}`}>
        {b.forecast.map((f) => (
          <div
            key={f.hour}
            className={`busy-col ${f.hour < nowH ? "past" : ""} ${f.hour === nowH ? "now" : ""} ${f.hour === b.quietestHour ? "quiet" : ""}`}
            onMouseEnter={() => setHover(f.hour)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="busy-bar" style={{ height: `${Math.max(8, f.score * 100)}%` }} />
            <span className="busy-hour">{f.hour % 3 === 0 || f.hour === nowH ? (f.hour === nowH ? "now" : hourLabel(f.hour)) : ""}</span>
          </div>
        ))}
        {shown !== null && (() => {
          const f = b.forecast.find((x) => x.hour === shown)!;
          return <div className="busy-tip" aria-hidden>{hourLabel(f.hour)} · usually {BUSY_LABEL[busyLevel(f.score)].text.toLowerCase()}</div>;
        })()}
      </div>
      <p className="tiny muted">{b.basedOn === "history" ? "Based on recent weeks and today's bookings." : "Based on a typical day and today's bookings."}</p>
    </div>
  );
}
