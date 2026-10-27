"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";

type Art = { id: number; staff_name: string; img: string; caption: string; votes: number; guest?: number };
type Week = { week: string; entries: Art[]; mine: number | null; lastWinner: Art | null };
const nice = (d: string) => new Date(`${d}T12:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function LatteArt() {
  const { toast } = useStore();
  const [w, setW] = useState<Week | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!(form.get("file") as File | null)?.size) return toast("Choose a photo first.");
    setBusy(true);
    const r = await fetch("/api/latte-art", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't upload.");
    (e.target as HTMLFormElement).reset(); setSent(true); toast("Sent ☕ The team will have a look.");
  }
  useEffect(() => { fetch(`/api/latte-art?voter=${voterId()}`).then((r) => r.json()).then(setW).catch(() => {}); }, []);
  async function vote(id: number) {
    const r = await fetch("/api/latte-art", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setW(d); toast("Vote in ☕ You can change it until Sunday.");
  }
  if (!w) return <div className="page"><p className="muted">Pouring…</p></div>;
  const sunday = new Date(Date.parse(`${w.week}T12:00:00Z`) + 6 * 86400_000).toISOString().slice(0, 10);
  return (
    <div className="page" style={{ maxWidth: "56rem" }}>
      <p className="eyebrow">from behind the counter</p>
      <h1 className="h2">Latte art <em>of the week</em></h1>
      <p className="lead">Our baristas post their best pours, and guests can send theirs too. Pick your favourite: one vote a week, and the winner goes up on the screen by the counter.</p>
      {w.lastWinner && (
        <section className="card latte-winner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={w.lastWinner.img} alt={`Last week's winning latte art by ${w.lastWinner.staff_name}`} />
          <div><span className="tiny muted">🏆 Last week&apos;s winner</span><b>{w.lastWinner.staff_name}</b>{w.lastWinner.caption && <span className="small">&ldquo;{w.lastWinner.caption}&rdquo;</span>}<span className="small muted">{w.lastWinner.votes} vote{w.lastWinner.votes === 1 ? "" : "s"}</span></div>
        </section>
      )}
      <h2 className="h3" style={{ marginTop: "1.4rem" }}>This week <span className="muted small">· voting closes {nice(sunday)}</span></h2>
      {w.entries.length ? (
        <ul className="latte-grid">
          {w.entries.map((a) => (
            <li key={a.id} className={`card latte-card ${w.mine === a.id ? "mine" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.img} alt={`Latte art by ${a.staff_name}${a.caption ? `: ${a.caption}` : ""}`} loading="lazy" />
              <span className="sum-row" style={{ alignItems: "center" }}>
                <span className="small"><b>{a.staff_name}</b>{a.guest ? <span className="tiny muted"> (guest)</span> : null}{a.caption && <span className="muted"> · {a.caption}</span>}</span>
                <button className={`chip ${w.mine === a.id ? "on" : ""}`} aria-pressed={w.mine === a.id} onClick={() => vote(a.id)}>{w.mine === a.id ? "♥ Your pick" : "Vote"} · {a.votes}</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="card muted center" style={{ padding: "1.4rem" }}>No pours posted yet this week ☕ Check back after the morning rush.</p>}
      <form className="card" onSubmit={send} style={{ padding: "1rem 1.2rem", marginTop: "1.4rem", display: "grid", gap: "0.6rem" }}>
        <h2 className="h3" style={{ margin: 0 }}>{sent ? "Send another pour?" : "Poured one at home?"}</h2>
        <p className="small muted" style={{ margin: 0 }}>Send a photo of your own latte art. Once the team has had a look it joins this week&apos;s vote, marked as a guest&apos;s. Only send photos you took yourself.</p>
        <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "end" }}>
          <label className="field" style={{ marginBottom: 0, maxWidth: "15rem" }}>Photo<input className="input" name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
          <label className="field" style={{ marginBottom: 0, maxWidth: "10rem" }}>First name<input className="input" name="name" maxLength={20} required placeholder="Riya" /></label>
          <label className="field" style={{ marginBottom: 0, maxWidth: "14rem" }}>Caption <span className="muted small">· optional</span><input className="input" name="caption" maxLength={60} placeholder="My first tulip" /></label>
          <button className="btn btn-pink btn-sm" disabled={busy}>{busy ? "Sending…" : "Send it"}</button>
        </div>
      </form>
    </div>
  );
}
