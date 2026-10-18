"use client";
import { useCallback, useEffect, useState } from "react";
import { SHIFT_PRESETS, fmtTime, shiftHours, type Shift } from "@/lib/rota";
import { toDateStr } from "@/lib/cafe";
import { useStore } from "../Store";
import Timesheets from "./Timesheets";

type Swap = { id: number; shift_id: number; from_id: number; to_id: number | null; taker_id: number | null; status: string; note: string | null; day: string; start: string; end: string; fromName: string; toName: string | null; takerName: string | null };
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
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [asking, setAsking] = useState<{ shiftId: number; toId: string; note: string } | null>(null);
  const loadSwaps = useCallback(() => fetch("/api/admin/swaps").then((r) => r.json()).then(setSwaps).catch(() => {}), []);
  useEffect(() => { loadSwaps(); }, [loadSwaps]);
  async function swapAct(body: object, msg: string) {
    const r = await fetch("/api/admin/swaps", json(body && "action" in body ? "PATCH" : "POST", body));
    if (!r.ok) return toast((await r.json()).error);
    toast(msg);
    setAsking(null);
    loadSwaps();
    load();
  }

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
                            {p.id === d.me && d.me !== 0 && day >= today && !swaps.some((w) => w.shift_id === s.id) && <button className="link-btn" onClick={() => setAsking({ shiftId: s.id, toId: "", note: "" })} aria-label={`Ask to swap your shift on ${label(day)}`} title="Ask someone to cover">⇄</button>}
                            {swaps.some((w) => w.shift_id === s.id) && <span className="tiny" title="Swap requested"> ⇄</span>}
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
      {asking && (
        <form className="card shift-form" onSubmit={(e) => { e.preventDefault(); swapAct({ shiftId: asking.shiftId, toId: asking.toId ? Number(asking.toId) : null, note: asking.note }, "Swap request sent ✓"); }}>
          <strong>Ask someone to cover this shift</strong>
          <label className="field">Who<select className="input" value={asking.toId} onChange={(e) => setAsking({ ...asking, toId: e.target.value })}>
            <option value="">Anyone on the team</option>
            {d.team.filter((t) => t.id !== d.me).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          <label className="field">Note<input className="input" maxLength={120} placeholder="e.g. exam that morning" value={asking.note} onChange={(e) => setAsking({ ...asking, note: e.target.value })} /></label>
          <p className="tiny muted">Once someone takes it, the owner approves and the rota updates.</p>
          <div className="row"><button className="btn btn-pink btn-sm">Ask</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(null)}>Cancel</button></div>
        </form>
      )}
      {swaps.length > 0 && (
        <section className="card" style={{ padding: "1rem 1.2rem" }}>
          <h3 style={{ fontSize: "1.1rem" }}>⇄ Shift swaps</h3>
          <ul className="check-list">
            {swaps.map((w) => (
              <li key={w.id}>
                <span style={{ flex: 1 }}>
                  <b>{w.fromName}</b>: {label(w.day)} {fmtTime(w.start)}–{fmtTime(w.end)}
                  {w.toName ? <> → asked <b>{w.toName}</b></> : " → anyone"}
                  {w.note && <span className="muted"> · {w.note}</span>}
                  {w.status === "taken" && <> · <span className="success">{w.takerName} will cover</span>{canEdit ? "" : ", waiting for the owner"}</>}
                </span>
                {w.status === "open" && d.me !== 0 && w.from_id !== d.me && (!w.to_id || w.to_id === d.me) && <button className="btn btn-pink btn-sm" onClick={() => swapAct({ id: w.id, action: "take" }, "Thanks for covering! Waiting for the owner ✿")}>I&apos;ll take it</button>}
                {canEdit && w.status === "taken" && <button className="btn btn-pink btn-sm" onClick={() => swapAct({ id: w.id, action: "approve" }, "Approved: the rota is updated")}>Approve</button>}
                {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => swapAct({ id: w.id, action: "decline" }, "Declined")}>Decline</button>}
                {w.from_id === d.me && !canEdit && <button className="btn btn-ghost btn-sm" onClick={() => swapAct({ id: w.id, action: "cancel" }, "Cancelled")}>Cancel</button>}
              </li>
            ))}
          </ul>
        </section>
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
      <Timesheets week={d.week} canEdit={canEdit} />
    </div>
  );
}
