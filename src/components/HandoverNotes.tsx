"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "./Store";

type N = { id: number; text: string; staff_name: string | null; created_at: string };
const send = (method: string, body: object) => fetch("/api/admin/handover", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Notes from the last shift to the next one ("oat milk is low", "grinder's acting up") */
export default function HandoverNotes() {
  const { toast } = useStore();
  const [list, setList] = useState<N[]>([]);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const load = useCallback(() => fetch("/api/admin/handover").then((r) => (r.ok ? r.json() : [])).then(setList).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 120_000); return () => clearInterval(t); }, [load]);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("POST", { text });
    if (!r.ok) return toast((await r.json()).error);
    setList(await r.json());
    setText("");
    setWriting(false);
    toast("Note left for the next shift ✓");
  }
  async function done(n: N) {
    const r = await send("PATCH", { id: n.id });
    if (r.ok) setList(await r.json());
  }
  const when = (t: string) => {
    const d = new Date(t.replace(" ", "T"));
    return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-IN", { weekday: "short" });
  };
  return (
    <div className="handover">
      {list.map((n) => (
        <div key={n.id} className="handover-note">
          <span>📝 <b>{n.text}</b> <small className="muted">· {n.staff_name ?? "staff"}, {when(n.created_at)}</small></span>
          <button className="link-btn small" onClick={() => done(n)}>Done ✓</button>
        </div>
      ))}
      {writing ? (
        <form className="row" onSubmit={add} style={{ gap: "0.4rem" }}>
          <input className="input" autoFocus maxLength={200} placeholder="e.g. Oat milk is low, order arrives 10am" aria-label="Note for the next shift" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-pink btn-sm" disabled={!text.trim()}>Leave note</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWriting(false)}>Cancel</button>
        </form>
      ) : <button className="link-btn small" onClick={() => setWriting(true)}>＋ Note for the next shift</button>}
    </div>
  );
}
