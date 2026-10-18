"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";
import EquipmentCard from "./EquipmentCard";
import HandoverNotes from "../HandoverNotes";

type Item = { id: number; text: string; kind: "tick" | "temp"; done: { staff_name: string | null; value: number | null; done_at: string } | null; warn: boolean };
type List = { id: string; label: string; icon: string; items: Item[]; done: number; total: number };
type Data = { day: string; lists: List[]; history: { day: string; list: string; done: number }[]; fridgeMax: number };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Opening and closing tasks: tick them off; fridge temperatures get written down */
export default function ChecklistsTab({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [d, setD] = useState<Data | null>(null);
  const [temps, setTemps] = useState<Record<number, string>>({});
  const [add, setAdd] = useState({ list: "opening", text: "", kind: "tick" });
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => fetch("/api/admin/checklists").then((r) => r.json()).then(setD).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <p className="muted">Loading…</p>;

  async function tick(i: Item, done: boolean) {
    const r = await fetch("/api/admin/checklists", json("POST", { itemId: i.id, done, value: temps[i.id] }));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    if (x.warn) toast(`⚠️ That's above ${d!.fridgeMax} °C. Check the fridge and tell the owner.`);
    setD({ ...d!, lists: x.lists });
  }
  async function change(body: object) {
    const r = await fetch("/api/admin/checklists", json("PUT", body));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    setD({ ...d!, lists: x.lists });
    setAdd((a) => ({ ...a, text: "" }));
  }
  const hour = new Date().getHours();
  const order = hour >= 15 ? [...d.lists].reverse() : d.lists; // closing first in the afternoon

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      {order.map((l) => (
        <section key={l.id} className="card" style={{ padding: "1.1rem 1.2rem" }}>
          <div className="sum-row" style={{ alignItems: "center" }}>
            <h3 style={{ fontSize: "1.3rem" }}>{l.icon} {l.label}</h3>
            <span className={l.done === l.total ? "success" : "muted"}>{l.done}/{l.total}{l.done === l.total ? " ✓" : ""}</span>
          </div>
          <div className="meter" aria-hidden><span style={{ width: `${l.total ? (l.done / l.total) * 100 : 0}%` }} /></div>
          <ul className="check-list">
            {l.items.map((i) => (
              <li key={i.id} className={i.done ? "done" : ""}>
                {i.kind === "temp" && !i.done ? (
                  <form className="row" style={{ alignItems: "center", gap: "0.5rem", flex: 1 }} onSubmit={(e) => { e.preventDefault(); tick(i, true); }}>
                    <span style={{ flex: 1 }}>🌡 {i.text}</span>
                    <input className="input" style={{ width: "5.5rem" }} inputMode="decimal" placeholder="°C" aria-label={`${i.text} in °C`} value={temps[i.id] ?? ""} onChange={(e) => setTemps({ ...temps, [i.id]: e.target.value.replace(/[^\d.-]/g, "") })} />
                    <button className="btn btn-ghost btn-sm" disabled={!temps[i.id]}>Save</button>
                  </form>
                ) : (
                  <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", flex: 1, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!i.done} onChange={(e) => tick(i, e.target.checked)} />
                    <span>{i.kind === "temp" ? "🌡 " : ""}{i.text}{i.done && i.kind === "temp" && <b className={i.warn ? "cashup-bad" : ""}> · {i.done.value} °C{i.warn ? " ⚠️" : ""}</b>}</span>
                  </label>
                )}
                {i.done && <small className="muted">{i.done.staff_name} · {i.done.done_at.slice(11, 16)}</small>}
                {editing && <button className="link-btn small" onClick={() => change({ removeId: i.id })} aria-label={`Remove ${i.text}`}>Remove</button>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="card" style={{ padding: "1rem 0.2rem 0.6rem" }}><h3 style={{ fontSize: "1.1rem", padding: "0 1rem" }}>📝 Notes for the next shift</h3><HandoverNotes /></section>
      <EquipmentCard canEdit={canEdit} />
      {canEdit && (
        <section className="card" style={{ padding: "1rem 1.2rem" }}>
          <div className="sum-row" style={{ alignItems: "center" }}>
            <b>Edit the lists</b>
            <button className="link-btn small" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Remove tasks"}</button>
          </div>
          <div className="pnl-add" style={{ gridTemplateColumns: "auto 1fr auto auto" }}>
            <select className="input" value={add.list} onChange={(e) => setAdd({ ...add, list: e.target.value })} aria-label="List">{d.lists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
            <input className="input" placeholder="New task" aria-label="New task" maxLength={140} value={add.text} onChange={(e) => setAdd({ ...add, text: e.target.value })} />
            <label className="row small" style={{ gap: "0.3rem", alignItems: "center" }}><input type="checkbox" checked={add.kind === "temp"} onChange={(e) => setAdd({ ...add, kind: e.target.checked ? "temp" : "tick" })} /> temperature</label>
            <button className="btn btn-pink btn-sm" disabled={!add.text.trim()} onClick={() => change(add)}>Add</button>
          </div>
        </section>
      )}
    </div>
  );
}
