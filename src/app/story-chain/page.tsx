"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { CHAIN_LINES, LINE_MAX } from "@/lib/storyChain";

type Line = { text: string; name: string };
type S = { story: { id: number; opener: string; lines: Line[] }; left: number; waiting: boolean; lastIsMine: boolean; done: { id: number; opener: string; done_at: string; lines: Line[] }[] };

export default function StoryChain() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [f, setF] = useState({ text: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const load = () => fetch(`/api/story-chain?voter=${voterId()}`).then((r) => r.json()).then(setS).catch(() => {});
  useEffect(() => { load(); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/story-chain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, voter: voterId() }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setF({ ...f, text: "" }); load();
    toast("📜 Lovely. It joins the story once we've read it.");
  }
  if (!s) return <div className="page"><p className="muted">Finding our place in the story…</p></div>;
  const count = s.story.lines.length + 1;
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">written by everyone</p>
      <h1 className="h2">Story <em>chain</em></h1>
      <p className="lead">A story told one sentence at a time, by a different guest each time. Read where it&apos;s got to, then add what happens next.</p>
      <article className="card chain-story">
        <span className="tiny muted">Line {count} of {CHAIN_LINES}</span>
        <p><span className="chain-line opener">{s.story.opener}</span>{s.story.lines.map((l, i) => <span key={i} className="chain-line" title={l.name ? `by ${l.name}` : undefined}> {l.text}</span>)}</p>
        <div className="explore-bar" role="progressbar" aria-valuemin={0} aria-valuemax={CHAIN_LINES} aria-valuenow={count} aria-label="How far the story has got"><span style={{ width: `${(count / CHAIN_LINES) * 100}%` }} /></div>
      </article>
      {s.waiting ? <p className="card small center" style={{ padding: "1rem" }}>✿ Your line is waiting to be read. Come back to see what happens next!</p>
        : s.lastIsMine ? <p className="card small center" style={{ padding: "1rem" }}>You wrote the last line! Let someone else carry it on.</p>
        : (
        <form className="card kind-form" onSubmit={send}>
          <label className="field">What happens next?<textarea className="input" rows={2} maxLength={LINE_MAX} required value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="One sentence…" /></label>
          <div className="row" style={{ alignItems: "end", flexWrap: "wrap", justifyContent: "space-between" }}>
            <label className="field" style={{ maxWidth: "12rem" }}>Name <span className="muted small">· optional</span><input className="input" maxLength={20} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <span className="row" style={{ alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}><span className="tiny muted">{f.text.length}/{LINE_MAX}</span><button className="btn btn-pink btn-sm" disabled={busy || f.text.trim().length < 8}>{busy ? "Sending…" : "Add my line"}</button></span>
          </div>
        </form>
      )}
      <h2 className="h3" style={{ marginTop: "1.6rem" }}>Finished stories</h2>
      {s.done.length ? (
        <ul className="story-list">
          {s.done.map((d) => (
            <li key={d.id} className="card">
              <button className="link-btn recipe-title" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}><b>{d.opener.split(" ").slice(0, 8).join(" ")}…</b></button>
              <span className="tiny muted"> · {d.lines.length + 1} lines · finished {new Date(d.done_at.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              {open === d.id && <p className="chain-read">{d.opener} {d.lines.map((l) => l.text).join(" ")}</p>}
            </li>
          ))}
        </ul>
      ) : <p className="small muted">The first story is still being written.</p>}
    </div>
  );
}
