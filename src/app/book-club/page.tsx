"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { monthLabel } from "@/lib/comeback";

type Pick = { month: string; title: string; author: string; date: string | null; time: string | null; eventId: string | null } | null;
type S = { month: string; pick: Pick; next: Pick; thoughts: { id: number; name: string; stars: number; text: string }[]; stars: number | null; ratings: number; past: NonNullable<Pick>[] };
const when = (p: NonNullable<Pick>) => p.date ? `${new Date(`${p.date}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}${p.time ? `, ${new Date(`2000-01-01T${p.time}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}` : null;

export default function BookClub() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [f, setF] = useState({ name: "", stars: 0, text: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { fetch("/api/book-club").then((r) => r.json()).then(setS).catch(() => {}); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!f.stars) return toast("Tap the stars to rate it");
    setBusy(true);
    const r = await fetch("/api/book-club", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setSent(true); toast("📚 Thanks! It'll show here once we've read it.");
  }
  if (!s) return <div className="page narrow"><p className="muted">Finding the bookmark…</p></div>;
  const p = s.pick;
  return (
    <div className="page" style={{ maxWidth: "42rem" }}>
      <p className="eyebrow">{monthLabel(s.month)}</p>
      <h1 className="h2">Book <em>club</em></h1>
      <p className="lead">One book a month from our shelf. Borrow a copy at the café, read it with a coffee, and come and talk about it.</p>
      {!p ? <p className="muted">This month&apos;s book hasn&apos;t been chosen yet. Check back soon ✿</p> : (
        <>
          <section className="card book-now">
            <span className="book-spine" aria-hidden="true">📖</span>
            <div>
              <span className="small muted">This month we&apos;re reading</span>
              <h2 className="h3" style={{ margin: "0.1rem 0" }}>{p.title}</h2>
              {p.author && <span className="small">{p.author}</span>}
              {s.stars !== null && <p className="small" style={{ margin: "0.4rem 0 0" }}><span className="book-stars" aria-label={`${s.stars} out of 5`}>{"★".repeat(Math.round(s.stars))}{"☆".repeat(5 - Math.round(s.stars))}</span> {s.stars} from {s.ratings} reader{s.ratings === 1 ? "" : "s"}</p>}
              {when(p) ? <p className="small" style={{ margin: "0.4rem 0 0" }}>☕ We meet <b>{when(p)}</b>{p.eventId && <> · <Link href="/#events">save a spot</Link></>}</p> : <p className="small muted" style={{ margin: "0.4rem 0 0" }}>Meet-up date coming soon.</p>}
            </div>
          </section>
          <h2 className="h3" style={{ marginTop: "1.4rem" }}>What readers think</h2>
          {s.thoughts.length ? (
            <ul className="book-thoughts">
              {s.thoughts.map((t) => (
                <li key={t.id} className="card">
                  <span className="book-stars" aria-label={`${t.stars} out of 5`}>{"★".repeat(t.stars)}{"☆".repeat(5 - t.stars)}</span>
                  {t.text && <p className="small" style={{ margin: "0.3rem 0" }}>{t.text}</p>}
                  <span className="tiny muted">{t.name}</span>
                </li>
              ))}
            </ul>
          ) : <p className="small muted">No thoughts yet. Finished it? Be the first.</p>}
          {!sent ? (
            <form className="card book-form" onSubmit={send}>
              <span className="small"><b>Your thoughts</b> <span className="muted">· finished or not</span></span>
              <span className="star-pick" role="radiogroup" aria-label="Stars">
                {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={f.stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} className={n <= f.stars ? "on" : ""} onClick={() => setF({ ...f, stars: n })}>★</button>)}
              </span>
              <textarea className="input" rows={3} maxLength={400} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="What stayed with you? (no big spoilers, please)" />
              <div className="row" style={{ alignItems: "end" }}>
                <label className="field">Your name<input className="input" required maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="First name" /></label>
                <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy}>{busy ? "Sending…" : "Share"}</button>
              </div>
            </form>
          ) : <p className="small">💌 Thanks for sharing. We read every one before it goes up.</p>}
        </>
      )}
      {s.next && <p className="small" style={{ marginTop: "1.4rem" }}>📅 Next month: <b>{s.next.title}</b>{s.next.author ? ` by ${s.next.author}` : ""}. Get a head start.</p>}
      {s.past.length > 0 && <p className="small muted">Before: {s.past.map((x) => x.title).join(" · ")}</p>}
      <p className="small"><Link href="/shelf">📚 See everything on the shelf →</Link></p>
    </div>
  );
}
