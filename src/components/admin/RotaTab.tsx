"use client";
import { useCallback, useEffect, useState } from "react";
import { SHIFT_PRESETS, fmtTime, shiftHours, type Shift } from "@/lib/rota";
import { toDateStr } from "@/lib/cafe";
import { useStore } from "../Store";

type Data = { week: string; days: string[]; shifts: Shift[]; team: { id: number; name: string; role: string }[]; me: number };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const shiftWeek = (monday: string, by: number) => toDateStr(new Date(new Date(monday + "T12:00").getTime() + by * 7 * 86_400_000));

/** Weekly staff rota. Owners add and remove shifts; baristas see the plan. */
export default function RotaTab({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [week, setWeek] = useState<string | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [adding, setAdding] = useState<{ staffId: number; day: string } | null>(null);
  const [form, setForm] = useState({ start: "07:00", end: "13:00", note: "" });

  const load = useCallback(() => {
    fetch(`/api/admin/shifts${week ? `?week=${week}` : ""}`).then((r) => r.json()).then((x) => { setD(x); setWeek(x.week); }).catch(() => {});
  }, [week]);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!adding) return;
    const r = await fetch("/api/admin/shifts", json("POST", { ...adding, ...form }));
    if (!r.ok) return toast((await r.json()).error);
    setAdding(null);
    load();
  }
  async function remove(id: number) {
    const r = await fetch("/api/admin/shifts", json("DELETE", { id }));
    if (!r.ok) return toast((await r.json()).error);
    load();
  }

  if (!d) return <p className="muted">Loading…</p>;
  const today = toDateStr(new Date());
  const label = (day: string) => new Date(day + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div className="row" style={{ alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeek(shiftWeek(d.week, -1))} aria-label="Previous week">←</button>
          <strong>Week of {new Date(d.week + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</strong>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeek(shiftWeek(d.week, 1))} aria-label="Next week">→</button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeek(null)}>This week</button>
      </div>
      {!d.team.length && <p className="muted">Add baristas in the <b>Team</b> tab first, then plan their shifts here.</p>}
      {d.team.length > 0 && (
        <div className="rota-wrap">
          <table className="rota">
            <thead>
              <tr>
                <th scope="col">Team</th>
                {d.days.map((day) => <th key={day} scope="col" className={day === today ? "today" : ""}>{label(day)}</th>)}
                <th scope="col">Hours</th>
              </tr>
            </thead>
            <tbody>
              {d.team.map((p) => {
                const mine = d.shifts.filter((s) => s.staff_id === p.id);
                const hours = mine.reduce((t, s) => t + shiftHours(s.start, s.end), 0);
                return (
                  <tr key={p.id} className={p.id === d.me ? "me" : ""}>
                    <th scope="row">{p.name}{p.id === d.me ? " (you)" : ""}</th>
                    {d.days.map((day) => (
                      <td key={day} className={day === today ? "today" : ""}>
                        {mine.filter((s) => s.day === day).map((s) => (
                          <span key={s.id} className="shift" title={s.note ?? undefined}>
                            {fmtTime(s.start)}–{fmtTime(s.end)}
                            {canEdit && <button className="link-btn" onClick={() => remove(s.id)} aria-label={`Remove ${p.name}'s shift on ${label(day)}`}>✕</button>}
                          </span>
                        ))}
                        {canEdit && <button className="shift-add" onClick={() => { setAdding({ staffId: p.id, day }); }} aria-label={`Add a shift for ${p.name} on ${label(day)}`}>+</button>}
                      </td>
                    ))}
                    <td><b>{hours}</b>h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {adding && (
        <form className="card shift-form" onSubmit={add}>
          <strong>New shift: {d.team.find((t) => t.id === adding.staffId)?.name}, {label(adding.day)}</strong>
          <div className="chips" style={{ justifyContent: "flex-start" }}>
            {SHIFT_PRESETS.map((p) => (
              <button type="button" key={p.label} className={`chip ${form.start === p.start && form.end === p.end ? "on" : ""}`} onClick={() => setForm({ ...form, start: p.start, end: p.end })}>
                {p.label} · {fmtTime(p.start)}–{fmtTime(p.end)}
              </button>
            ))}
          </div>
          <div className="row">
            <label className="field">Starts<input className="input" type="time" step={900} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
            <label className="field">Ends<input className="input" type="time" step={900} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
            <label className="field" style={{ flex: 1 }}>Note<input className="input" maxLength={60} placeholder="e.g. opening, latte art class" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          </div>
          <div className="row">
            <button className="btn btn-pink btn-sm">Add shift</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
