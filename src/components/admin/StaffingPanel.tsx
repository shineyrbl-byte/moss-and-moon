"use client";
import { useEffect, useState } from "react";
import { hourText } from "@/lib/cafe";

type H = { hour: number; orders: number; guests: number; need: number; have: number };
type D = { day: string; closed: boolean; hours: H[] };

/** Under the rota: people needed each hour (from past orders and bookings) vs people on shift */
export default function StaffingPanel({ week, version }: { week: string; version: number }) {
  const [d, setD] = useState<{ estimated: boolean; days: D[] } | null>(null);
  useEffect(() => { fetch(`/api/admin/staffing?week=${week}`).then((r) => r.json()).then(setD).catch(() => {}); }, [week, version]);
  if (!d) return null;
  const open = d.days.filter((x) => !x.closed);
  if (!open.length) return null;
  const from = Math.min(...open.map((x) => x.hours[0].hour));
  const to = Math.max(...open.map((x) => x.hours.at(-1)!.hour));
  const cols = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const label = (day: string) => new Date(day + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

  // Short stretches, e.g. "Sat 9am–11am: need 3, rota has 2"
  const gaps: string[] = [];
  for (const x of open) {
    let run: H[] = [];
    const flush = () => { if (run.length) gaps.push(`${label(x.day)} ${hourText(run[0].hour)}–${hourText(run.at(-1)!.hour + 1)}: need ${Math.max(...run.map((r) => r.need))}, rota has ${Math.min(...run.map((r) => r.have))}`); run = []; };
    for (const h of x.hours) { if (h.have < h.need) run.push(h); else flush(); }
    flush();
  }

  return (
    <section className="card" style={{ padding: "1rem 1.2rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>👥 Do we have enough people?</h3>
      <p className="small muted">{d.estimated ? "Estimated from a typical café day until there are a few weeks of orders. " : "From the last 8 weeks of orders on each weekday, plus bookings. "}One barista per ~14 orders an hour, and an extra pair of hands when lots of guests are booked.</p>
      {gaps.length ? (
        <ul className="small" style={{ margin: "0.4rem 0 0.8rem", paddingLeft: "1.2rem" }}>{gaps.slice(0, 8).map((g) => <li key={g} className="cashup-bad">{g}</li>)}</ul>
      ) : <p className="small success">✓ Every open hour this week has enough people.</p>}
      <div className="rota-wrap">
        <table className="rota staffing">
          <thead><tr><th scope="col">Day</th>{cols.map((c) => <th key={c} scope="col">{hourText(c)}</th>)}</tr></thead>
          <tbody>
            {d.days.map((x) => (
              <tr key={x.day}>
                <th scope="row">{label(x.day)}</th>
                {x.closed ? <td colSpan={cols.length} className="muted small">closed</td> : cols.map((c) => {
                  const h = x.hours.find((y) => y.hour === c);
                  if (!h) return <td key={c} />;
                  const cls = h.have < h.need ? "short" : h.have > h.need + 1 ? "over" : "ok";
                  return <td key={c} className={cls} title={`${hourText(c)}: about ${h.orders} orders${h.guests ? `, ${h.guests} booked guests` : ""}. Need ${h.need}, on rota ${h.have}.`}>{h.have}/{h.need}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted">Each box: people on the rota / people needed. Pink is short, faded has spare hands.</p>
    </section>
  );
}
