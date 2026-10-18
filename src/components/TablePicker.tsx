"use client";
import { useEffect, useState } from "react";

type T = { no: number; seats: number; zone: string; x: number; y: number; w: number; h: number; round?: boolean; free: boolean; fits: boolean };

/** Floor plan: tap a free table that fits your group, or leave it to us */
export default function TablePicker({ date, time, guests, value, onChange }: { date: string; time: string; guests: number; value: number | null; onChange: (n: number | null) => void }) {
  const [tables, setTables] = useState<T[] | null>(null);
  const [counter, setCounter] = useState({ x: 32, y: 76, w: 40, h: 14 });
  useEffect(() => {
    if (!date || !time) return;
    setTables(null);
    fetch(`/api/bookings/tables?date=${date}&time=${time}&guests=${guests}`).then((r) => r.json()).then((d) => { setTables(d.tables); setCounter(d.counter); }).catch(() => setTables([]));
  }, [date, time, guests]);
  // A chosen table that's no longer free or big enough gets dropped
  useEffect(() => {
    if (value && tables && !tables.some((t) => t.no === value && t.free && t.fits)) onChange(null);
  }, [tables, value, onChange]);

  if (!time) return null;
  if (!tables) return <span className="small muted">Loading the floor plan…</span>;
  if (!tables.length) return null;
  const pick = tables.find((t) => t.no === value);
  return (
    <div className="field">
      <span>Pick your table <span className="muted small">· optional</span></span>
      <svg className="floor" viewBox="0 0 100 95" role="group" aria-label="Café floor plan">
        <defs>
          <pattern id="floor-taken" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" className="floor-hatch" /></pattern>
        </defs>
        <rect x="0.5" y="0.5" width="99" height="94" rx="3" className="floor-room" />
        <text x="50" y="4.2" className="floor-label" textAnchor="middle">windows</text>
        <rect x={counter.x} y={counter.y} width={counter.w} height={counter.h} rx="2" className="floor-counter" />
        <text x={counter.x + counter.w / 2} y={counter.y + counter.h / 2 + 1.4} className="floor-label" textAnchor="middle">counter</text>
        {tables.map((t) => {
          const ok = t.free && t.fits;
          const on = value === t.no;
          const cls = `floor-table ${on ? "on" : ok ? "ok" : t.free ? "small" : "taken"}`;
          const label = `Table ${t.no}, ${t.zone}, seats ${t.seats}${!t.free ? ", already booked" : !t.fits ? ", doesn't fit your group" : ""}`;
          const act = () => ok && onChange(on ? null : t.no);
          return (
            <g key={t.no} className={cls} role="button" tabIndex={ok ? 0 : -1} aria-pressed={on} aria-disabled={!ok} aria-label={label}
              onClick={act} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } }}>
              <title>{label}</title>
              {t.round
                ? <ellipse cx={t.x + t.w / 2} cy={t.y + t.h / 2} rx={t.w / 2} ry={t.h / 2} />
                : <rect x={t.x} y={t.y} width={t.w} height={t.h} rx="2.5" />}
              <text x={t.x + t.w / 2} y={t.y + t.h / 2 - 0.5} textAnchor="middle" className="floor-no">{t.no}</text>
              <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 4} textAnchor="middle" className="floor-seats">{t.free ? `${t.seats} seats` : "booked"}</text>
            </g>
          );
        })}
      </svg>
      <span className="small muted" aria-live="polite">
        {pick ? <>Table {pick.no}: {pick.zone.toLowerCase()}, seats {pick.seats}. <button type="button" className="link-btn small" onClick={() => onChange(null)}>Let us choose instead</button></> : "No table picked: we'll seat you at the best free one."}
      </span>
    </div>
  );
}
