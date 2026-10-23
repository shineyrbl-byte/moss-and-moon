"use client";
import { useEffect, useState } from "react";
import { SEAT_TAGS, type SeatTag } from "@/lib/floor";

type T = { no: number; seats: number; zone: string; x: number; y: number; w: number; h: number; round?: boolean; free: boolean; fits: boolean; tags?: SeatTag[] };
const icon = (t: SeatTag) => SEAT_TAGS.find((x) => x.id === t)?.icon ?? "";

/** Floor plan: tap a free table that fits your group, or leave it to us */
export default function TablePicker({ date, time, guests, value, onChange, prefer = [] }: { date: string; time: string; guests: number; value: number | null; onChange: (n: number | null) => void; prefer?: SeatTag[] }) {
  const [tables, setTables] = useState<T[] | null>(null);
  // Seat finder: highlight tables with every tag picked
  const [want, setWant] = useState<SeatTag[]>(prefer);
  const preferKey = prefer.join();
  useEffect(() => { setWant((w) => [...new Set([...w, ...prefer])]); }, [preferKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = (t: T) => want.every((x) => t.tags?.includes(x));
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
      <div className="chips seat-chips" role="group" aria-label="Find a seat with">
        {SEAT_TAGS.map((g) => <button type="button" key={g.id} aria-pressed={want.includes(g.id)} className={`chip ${want.includes(g.id) ? "on" : ""}`} onClick={() => setWant((w) => (w.includes(g.id) ? w.filter((x) => x !== g.id) : [...w, g.id]))}>{g.icon} {g.label}</button>)}
      </div>
      {want.length > 0 && !tables.some((t) => matches(t) && t.free && t.fits) && <span className="small muted">No free table has all of those at this time. Try fewer, or another time.</span>}
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
          const cls = `floor-table ${on ? "on" : ok ? "ok" : t.free ? "small" : "taken"}${want.length && !matches(t) ? " dim" : ""}${want.length && matches(t) && ok ? " match" : ""}`;
          const tagWords = (t.tags ?? []).map((x) => SEAT_TAGS.find((g) => g.id === x)?.label.toLowerCase()).join(", ");
          const label = `Table ${t.no}, ${t.zone}, seats ${t.seats}${tagWords ? `, ${tagWords}` : ""}${!t.free ? ", already booked" : !t.fits ? ", doesn't fit your group" : ""}`;
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
              {!!t.tags?.length && <text x={t.x + t.w / 2} y={t.y + t.h + 3.6} textAnchor="middle" className="floor-tags" aria-hidden>{t.tags.map(icon).join("")}</text>}
            </g>
          );
        })}
      </svg>
      <span className="small muted" aria-live="polite">
        {pick ? <>Table {pick.no}: {pick.zone.toLowerCase()}, seats {pick.seats}{pick.tags?.length ? ` ${pick.tags.map(icon).join("")}` : ""}. <button type="button" className="link-btn small" onClick={() => onChange(null)}>Let us choose instead</button></> : "No table picked: we'll seat you at the best free one."}
      </span>
    </div>
  );
}
