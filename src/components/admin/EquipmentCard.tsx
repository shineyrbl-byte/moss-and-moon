"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";
import { rupees } from "@/lib/pricing";

type Item = { id: number; name: string; task: string; every_days: number; last_done: string | null; due: string; daysLeft: number; overdue: boolean; soon: boolean };
type Log = { id: number; kind: string; note: string | null; cost: number; staff_name: string | null; created_at: string; name: string; task: string };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const when = (n: number) => (n < 0 ? `${-n} day${n === -1 ? "" : "s"} overdue` : n === 0 ? "due today" : `in ${n} day${n === 1 ? "" : "s"}`);

/** Machine care: service reminders, and a log of repairs */
export default function EquipmentCard({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [d, setD] = useState<{ items: Item[]; log: Log[] } | null>(null);
  const [repair, setRepair] = useState<{ id: number; note: string; cost: string } | null>(null);
  const [add, setAdd] = useState({ name: "", task: "", everyDays: "30" });
  const load = useCallback(() => fetch("/api/admin/equipment").then((r) => r.json()).then(setD).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  async function send(method: string, body: object, msg: string) {
    const r = await fetch("/api/admin/equipment", json(method, body));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    setD(x);
    setRepair(null);
    setAdd({ name: "", task: "", everyDays: "30" });
    toast(msg);
  }
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
      <h3 style={{ fontSize: "1.3rem" }}>🔧 Equipment</h3>
      <ul className="check-list">
        {d.items.map((e) => (
          <li key={e.id}>
            <span style={{ flex: 1 }}><b>{e.name}</b>: {e.task} <span className={e.overdue ? "cashup-bad" : e.soon ? "" : "muted"}>· {when(e.daysLeft)}</span><br /><small className="muted">every {e.every_days} days{e.last_done ? `, last done ${e.last_done}` : ""}</small></span>
            <button className="btn btn-ghost btn-sm" onClick={() => send("POST", { id: e.id, kind: "service" }, `${e.task}: done ✓`)}>Done</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRepair({ id: e.id, note: "", cost: "" })}>Log a repair</button>
            {canEdit && <button className="link-btn small" onClick={() => send("PUT", { removeId: e.id }, "Removed")} aria-label={`Remove ${e.task}`}>✕</button>}
            {repair?.id === e.id && (
              <form className="pnl-add" style={{ gridTemplateColumns: "2fr 1fr auto auto", width: "100%" }} onSubmit={(ev) => { ev.preventDefault(); send("POST", { id: e.id, kind: "repair", note: repair.note, cost: Number(repair.cost) || 0 }, "Repair logged"); }}>
                <input className="input" placeholder="What was wrong / fixed" aria-label="What was fixed" maxLength={140} value={repair.note} onChange={(x) => setRepair({ ...repair, note: x.target.value })} />
                <input className="input" placeholder="₹ cost" inputMode="numeric" aria-label="Cost" value={repair.cost} onChange={(x) => setRepair({ ...repair, cost: x.target.value.replace(/\D/g, "") })} />
                <button className="btn btn-pink btn-sm" disabled={!repair.note.trim()}>Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRepair(null)}>Cancel</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="pnl-add" style={{ gridTemplateColumns: "1fr 1.6fr auto auto" }}>
          <input className="input" placeholder="Machine" aria-label="Machine" maxLength={40} value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <input className="input" placeholder="Job, e.g. replace the filter" aria-label="Job" maxLength={80} value={add.task} onChange={(e) => setAdd({ ...add, task: e.target.value })} />
          <label className="row small" style={{ gap: "0.3rem", alignItems: "center" }}>every<input className="input" style={{ width: "4.5rem" }} inputMode="numeric" aria-label="Every how many days" value={add.everyDays} onChange={(e) => setAdd({ ...add, everyDays: e.target.value.replace(/\D/g, "") })} />days</label>
          <button className="btn btn-pink btn-sm" disabled={!add.name.trim() || !add.task.trim()} onClick={() => send("PUT", add, "Reminder added")}>Add</button>
        </div>
      )}
      {d.log.length > 0 && (
        <details style={{ marginTop: "0.8rem" }}>
          <summary className="small">History</summary>
          <ul className="backup-list">{d.log.map((l) => <li key={l.id}><span>{l.created_at.slice(0, 10)} · {l.name}: {l.kind === "service" ? l.task : l.note}</span><span className="muted">{l.staff_name}{l.cost ? ` · ${rupees(l.cost)}` : ""}</span><span /></li>)}</ul>
        </details>
      )}
      <p className="tiny muted">Repair costs are added to this month&apos;s P&amp;L. Anything due shows in the nightly email.</p>
    </section>
  );
}
