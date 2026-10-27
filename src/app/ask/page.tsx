"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

type Q = { id: number; q: string; name: string; answer: string; answered_by: string; answered_at: string };

export default function Ask() {
  const { toast } = useStore();
  const [list, setList] = useState<Q[] | null>(null);
  const [search, setSearch] = useState("");
  const [f, setF] = useState({ q: "", name: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/ask").then((r) => r.json()).then((d) => setList(d.questions)).catch(() => setList([])); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setF({ ...f, q: "" });
    toast("💬 Thanks! We'll answer it here soon.");
  }
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (list ?? []).filter((x) => words.every((w) => `${x.q} ${x.answer}`.toLowerCase().includes(w)));
  return (
    <div className="page" style={{ maxWidth: "42rem" }}>
      <p className="eyebrow">questions, answered</p>
      <h1 className="h2">Ask us <em>anything</em></h1>
      <p className="lead">Wondering if the oat milk is sweetened, or whether you can bring your laptop on a Saturday? Ask away. A real person from the team answers, and the answer goes up here for everyone.</p>
      <form className="card kind-form" onSubmit={send}>
        <label className="field">Your question<textarea className="input" rows={2} maxLength={200} required value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Do you have decaf?" /></label>
        <div className="row" style={{ alignItems: "end", flexWrap: "wrap", justifyContent: "space-between" }}>
          <label className="field" style={{ maxWidth: "12rem" }}>Name <span className="muted small">· optional</span><input className="input" maxLength={20} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy || f.q.trim().length < 10}>{busy ? "Sending…" : "Ask"}</button>
        </div>
      </form>
      <div className="row" style={{ margin: "1.4rem 0 0.6rem", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <h2 className="h3" style={{ margin: 0 }}>Answered <span className="muted small">· {list?.length ?? 0}</span></h2>
        {(list?.length ?? 0) > 4 && <input className="input" style={{ maxWidth: "14rem" }} aria-label="Search questions" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />}
      </div>
      <ul className="story-list">
        {shown.map((x) => (
          <li key={x.id} className="card ask-card">
            <b>{x.q}</b>
            <p className="small" style={{ margin: "0.3rem 0 0", whiteSpace: "pre-line" }}>{x.answer}</p>
            <span className="tiny muted">{x.answered_by ? `${x.answered_by} from the team` : "The team"}{x.name ? ` · asked by ${x.name}` : ""}</span>
          </li>
        ))}
        {list && !shown.length && <li className="muted small" style={{ listStyle: "none" }}>{list.length ? "Nothing matches that. Ask it above!" : "No questions yet. Be the first!"}</li>}
      </ul>
    </div>
  );
}
