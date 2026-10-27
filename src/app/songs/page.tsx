"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { useLive } from "@/components/useLive";
import { voterId } from "@/components/LabCard";

type S = { id: number; title: string; artist: string; name: string; votes?: number; mine?: boolean };
type NP = { playing: S | null; next: S[] };

export default function Songs() {
  const { table, toast } = useStore();
  const [np, setNp] = useState<NP | null>(null);
  const [kick, setKick] = useState(0);
  const [form, setForm] = useState({ title: "", artist: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  useLive("/api/live?topic=board", () => setKick((k) => k + 1));
  useEffect(() => { fetch(`/api/songs?voter=${voterId()}`).then((r) => r.json()).then(setNp).catch(() => {}); }, [kick]);
  async function vote(s: S) {
    const r = await fetch("/api/songs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), vote: s.id, undo: s.mine }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast(d.error ?? "That vote didn't go through.");
    setNp(d);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/songs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, table }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "That didn't send. Try again?");
    setSent(true);
    setForm((f) => ({ ...f, title: "", artist: "" }));
    toast("🎵 Sent! The team will add it to the list.");
  }
  const who = (s: S) => `${s.artist ? `${s.artist} · ` : ""}asked for by ${s.name}`;

  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">on the speakers</p>
      <h1 className="h2">Song <em>requests</em></h1>
      <p className="lead">Ask for a song and the barista will queue it up. We keep it cosy, so loud or explicit tracks may be skipped.</p>

      <section className="card song-now" aria-live="polite">
        <span className="tiny muted">NOW PLAYING</span>
        {np?.playing ? <><b>🎵 {np.playing.title}</b><span className="small muted">{who(np.playing)}</span></> : <span className="muted">The café playlist ✿</span>}
        {!!np?.next.length && (
          <>
            <span className="tiny muted" style={{ marginTop: "0.8rem" }}>UP NEXT</span>
            <ol className="song-next">{np.next.map((s) => <li key={s.id}><span><b>{s.title}</b> <span className="small muted">{who(s)}</span></span> <button className={`chip song-vote ${s.mine ? "on" : ""}`} aria-pressed={!!s.mine} onClick={() => vote(s)} aria-label={`${s.mine ? "Take back your vote for" : "Vote for"} ${s.title}, ${s.votes ?? 0} vote${s.votes === 1 ? "" : "s"}`}>▲ {s.votes ?? 0}</button></li>)}</ol>
            <span className="tiny muted">Vote for the songs you&apos;d like to hear next: the most votes go first.</span>
          </>
        )}
      </section>

      <form className="card" style={{ padding: "1.2rem", marginTop: "1rem", display: "grid", gap: "0.7rem" }} onSubmit={send}>
        <h2 style={{ fontSize: "1.1rem", margin: 0 }}>{sent ? "Ask for another?" : "Request a song"}</h2>
        <label className="field">Song<input className="input" required minLength={2} maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Kun Faya Kun" /></label>
        <div className="row">
          <label className="field">Artist <span className="muted small">· optional</span><input className="input" maxLength={60} value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} placeholder="A. R. Rahman" /></label>
          <label className="field">Your first name<input className="input" maxLength={30} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Riya" /></label>
        </div>
        {table && <p className="tiny muted">🪑 From table {table}</p>}
        {err && <p className="error small">{err}</p>}
        <button className="btn btn-pink" disabled={busy}>{busy ? "Sending…" : "🎵 Send request"}</button>
      </form>
    </div>
  );
}
