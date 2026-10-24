"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { NOTE_MAX } from "@/lib/kindNotes";

export default function KindNotes() {
  const { toast } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [got, setGot] = useState<{ note: string; house: boolean } | null>(null);
  const [count, setCount] = useState<{ notes: number; given: number } | null>(null);
  useEffect(() => { fetch("/api/kind-notes").then((r) => r.json()).then(setCount).catch(() => {}); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/kind-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voter: voterId() }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setGot({ note: d.note, house: d.house }); setText("");
  }
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">the note jar</p>
      <h1 className="h2">Notes for a <em>stranger</em></h1>
      <p className="lead">Write something kind for whoever comes next. In return, you&apos;ll get a note someone else left. No names, no replies, just a nice moment.</p>
      {count && count.given > 0 && <p className="small muted">💌 {count.given} note{count.given === 1 ? "" : "s"} passed on so far</p>}
      {got ? (
        <section className="kind-got" aria-live="polite">
          <span className="tiny muted">{got.house ? "From all of us at Moss & Moon" : "From a stranger, for you"}</span>
          <p>{got.note}</p>
          <span className="tiny muted">Yours goes in the jar once we&apos;ve read it ✿</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setGot(null)}>Write another</button>
        </section>
      ) : (
        <form className="card kind-form" onSubmit={send}>
          <label className="field">Your note<textarea className="input" rows={4} maxLength={NOTE_MAX} required value={text} onChange={(e) => setText(e.target.value)} placeholder="Hope your coffee's just right and your day's even better." /></label>
          <span className="sum-row" style={{ alignItems: "center" }}>
            <span className="tiny muted">{text.length}/{NOTE_MAX} · no names, links or numbers</span>
            <button className="btn btn-pink btn-sm" disabled={busy || text.trim().length < 10}>{busy ? "Folding it up…" : "Swap notes 💌"}</button>
          </span>
        </form>
      )}
    </div>
  );
}
