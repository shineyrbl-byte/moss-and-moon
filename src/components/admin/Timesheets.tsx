"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

type Entry = { id: number; clock_in: string; clock_out: string | null; auto: number };
type R = { week: string; tips: number; totalHours: number; people: { id: number; name: string; worked: number; planned: number; tip: number; entries: Entry[] }[] };
const t = (s: string) => s.slice(11, 16);
const day = (s: string) => new Date(s.slice(0, 10) + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

/** Hours worked vs planned, and the week's tips split by hours worked */
export default function Timesheets({ week, canEdit }: { week: string | null; canEdit: boolean }) {
  const { toast } = useStore();
  const [r, setR] = useState<R | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(() => fetch(`/api/admin/timesheets${week ? `?week=${week}` : ""}`).then((x) => x.json()).then(setR).catch(() => {}), [week]);
  useEffect(() => { load(); }, [load]);
  if (!r) return null;
  async function remove(id: number) {
    await fetch("/api/admin/timesheets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast("Removed");
    load();
  }
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.25rem" }}>⏱ Timesheets & tips</h3>
        <span className="small">Tips this week: <b>{rupees(r.tips)}</b> · {r.totalHours} h worked</span>
      </div>
      <p className="small muted">Baristas clock in and out on the barista screen. Tips are split by hours actually worked.</p>
      <div className="rota-wrap">
        <table className="rota" style={{ minWidth: 480 }}>
          <thead><tr><th scope="col">Team</th><th scope="col">Planned</th><th scope="col">Worked</th><th scope="col">Tip share</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
          <tbody>
            {r.people.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.name}</th>
                <td>{p.planned} h</td>
                <td className={p.worked > p.planned + 1 ? "today" : ""}>{p.worked} h</td>
                <td><b>{rupees(p.tip)}</b></td>
                <td><button className="link-btn small" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Hide" : `${p.entries.length} shifts`}</button></td>
              </tr>
            ))}
            {!r.people.length && <tr><td colSpan={5} className="muted">Add team members in the Team tab.</td></tr>}
          </tbody>
        </table>
      </div>
      {open !== null && (
        <ul className="backup-list">
          {r.people.find((p) => p.id === open)?.entries.map((e) => (
            <li key={e.id}>
              <span>{day(e.clock_in)} · {t(e.clock_in)}–{e.clock_out ? t(e.clock_out) : "now"}{e.auto ? <span className="muted small"> · auto clock-out</span> : null}</span>
              <span />
              {canEdit ? <button className="link-btn" onClick={() => remove(e.id)}>Remove</button> : <span />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
