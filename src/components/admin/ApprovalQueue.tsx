"use client";
// Staff: everything guests sent that's waiting for a look, in one list (oldest first)
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

type Item = { kind: string; label: string; id: number; text: string; who: string; img?: string; at: string };

export default function ApprovalQueue() {
  const { toast } = useStore();
  const [d, setD] = useState<{ items: Item[]; questions: number } | null>(null);
  const load = () => fetch("/api/admin/approvals").then((r) => (r.ok ? r.json() : null)).then((x) => x && setD(x)).catch(() => {});
  useEffect(() => { void load(); const t = setInterval(() => { if (!document.hidden) void load(); }, 60_000); return () => clearInterval(t); }, []);
  if (!d) return null;
  async function act(it: Item, approve: boolean) {
    const r = await fetch("/api/admin/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: it.kind, id: it.id, approve }) });
    const x = await r.json();
    if (!r.ok) { toast(x.error); return void load(); }
    setD(x); toast(approve ? "Approved ✓" : "Removed");
  }
  const total = d.items.length + d.questions;
  return (
    <section className="card" style={{ padding: "1rem 1.1rem", marginBottom: "1rem" }} aria-labelledby="aq-h">
      <h2 className="h3" id="aq-h" style={{ marginTop: 0 }}>📥 Waiting for a look {total ? <span className="chip on" style={{ padding: "0 0.5rem" }}>{total}</span> : null}</h2>
      {!total ? <p className="small muted" style={{ margin: 0 }}>Nothing waiting. Photos, latte art, recipes, notes, shout-outs, story lines, wishes, stories and song requests from guests land here.</p> : (
        <ul className="check-list">
          {d.items.map((it) => (
            <li key={`${it.kind}-${it.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.img && <img src={it.img} alt="" className="latte-thumb" />}
              <span style={{ flex: 1 }} className="small"><b>{it.label}</b>{it.who ? ` from ${it.who}` : ""}: {it.text}</span>
              <button className="chip" onClick={() => act(it, true)}>Approve</button> <button className="chip" onClick={() => act(it, false)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {d.questions > 0 && <p className="small" style={{ margin: "0.5rem 0 0" }}>❓ {d.questions} question{d.questions === 1 ? "" : "s"} to answer: see <b>Ask us anything</b> below.</p>}
    </section>
  );
}

/** A one-line nudge for the overview: how many guest posts are waiting */
export function ApprovalCount({ go }: { go: () => void }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { fetch("/api/admin/approvals").then((r) => (r.ok ? r.json() : null)).then((x) => x && setN(x.items.length + x.questions)).catch(() => {}); }, []);
  if (!n) return null;
  return <p className="mode-banner" style={{ margin: 0 }}><span>📥 <b>{n}</b> guest post{n === 1 ? "" : "s"} waiting for a look</span> <button className="link-btn" onClick={go}>See them →</button></p>;
}
