"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";
import { toDateStr } from "@/lib/cafe";

type B = { id: number; name: string; amount: string | null; use_by: string; staff_name: string | null; daysLeft: number; state: "expired" | "soon" | "ok" };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const when = (n: number) => (n < 0 ? `expired ${-n === 1 ? "yesterday" : `${-n} days ago`}` : n === 0 ? "use today" : n === 1 ? "use by tomorrow" : `${n} days left`);
const QUICK = ["Whole milk", "Oat milk", "Cream", "Curd", "Croissants", "Sourdough", "Cheesecake", "Mango pulp"];

/** Stock tab: batches with use-by dates, oldest first, so nothing goes off unnoticed */
export default function UseByCard() {
  const { toast } = useStore();
  const [d, setD] = useState<{ batches: B[]; stats: { used: number; thrown: number } } | null>(null);
  const [f, setF] = useState({ name: "", amount: "", useBy: "" });
  const load = useCallback(() => fetch("/api/admin/batches").then((r) => r.json()).then(setD).catch(() => {}), []);
  useEffect(() => { load(); setF((x) => ({ ...x, useBy: toDateStr(new Date(Date.now() + 3 * 86_400_000)) })); }, [load]);
  if (!d) return null;
  async function send(method: string, body: object, msg?: string) {
    const r = await fetch("/api/admin/batches", json(method, body));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    setD(x);
    if (msg) toast(msg);
  }
  const bad = d.batches.filter((b) => b.state !== "ok").length;
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.3rem" }}>📅 Use-by dates</h3>
        {bad > 0 && <span className="cashup-bad small">{bad} need{bad === 1 ? "s" : ""} attention</span>}
      </div>
      <p className="small muted">Log each delivery or bake with its date. Use the top of the list first.{d.stats.thrown + d.stats.used ? ` Last 30 days: ${d.stats.used} used up, ${d.stats.thrown} thrown away.` : ""}</p>
      <form className="pnl-add" style={{ gridTemplateColumns: "1.5fr 1fr 1fr auto" }} onSubmit={(e) => { e.preventDefault(); send("POST", f, "Logged ✓").then(() => setF((x) => ({ ...x, name: "", amount: "" }))); }}>
        <input className="input" list="batch-names" placeholder="What (e.g. Oat milk)" aria-label="What" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <datalist id="batch-names">{QUICK.map((q) => <option key={q} value={q} />)}</datalist>
        <input className="input" placeholder="How much (6 cartons)" aria-label="How much" maxLength={30} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input className="input" type="date" aria-label="Use by" value={f.useBy} onChange={(e) => setF({ ...f, useBy: e.target.value })} />
        <button className="btn btn-pink btn-sm" disabled={!f.name.trim() || !f.useBy}>Add</button>
      </form>
      {d.batches.length > 0 && (
        <ul className="check-list">
          {d.batches.map((b, i) => (
            <li key={b.id}>
              <span style={{ flex: 1 }}>
                {i === 0 && b.state !== "expired" && <span className="branch-tag" style={{ marginLeft: 0, marginRight: "0.4rem" }}>use first</span>}
                <b>{b.name}</b>{b.amount ? ` · ${b.amount}` : ""} <span className={b.state === "ok" ? "muted" : "cashup-bad"}>· {when(b.daysLeft)}{b.state === "expired" ? " ⚠️" : ""}</span>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => send("PATCH", { id: b.id, status: "used" })}>Used up</button>
              <button className="btn btn-ghost btn-sm" onClick={() => send("PATCH", { id: b.id, status: "thrown" }, "Marked as thrown away")}>Thrown away</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
