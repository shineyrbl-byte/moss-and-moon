"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { LETTER_MAX, LETTER_MONTHS } from "@/lib/letters";

type L = { id: number; open: true; openOn: string; written: string; body: string; ordered: string[] } | { id: number; open: false; openOn: string; written: string; days: number };
const nice = (d: string) => new Date(`${d}T12:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default function Letters() {
  const { toast } = useStore();
  const [letters, setLetters] = useState<L[] | null>(null);
  const [out, setOut] = useState(false);
  const [body, setBody] = useState("");
  const [months, setMonths] = useState<number>(6);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reading, setReading] = useState<number | null>(null);
  useEffect(() => { fetch("/api/account/letters").then(async (r) => { if (r.status === 401) return setOut(true); setLetters((await r.json()).letters); }).catch(() => {}); }, []);

  async function seal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/account/letters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, months }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "That didn't save. Try again?");
    setLetters(d.letters); setBody("");
    toast(`✉️ Sealed. It opens on ${nice(d.openOn)}`);
  }

  if (out) return (
    <div className="page narrow center">
      <span style={{ fontSize: "3rem" }}>✉️</span>
      <h1 className="h2">Letters to <em>future you</em></h1>
      <p className="lead">Write yourself a note over coffee and seal it for a few months. It opens on your account when the day comes.</p>
      <Link className="btn btn-pink" href="/account">Sign in to write one</Link>
    </div>
  );
  if (!letters) return <div className="page narrow"><p className="muted">Fetching your letters…</p></div>;
  const opened = letters.filter((l) => l.open);
  const sealed = letters.filter((l) => !l.open);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">sealed with a coffee ring</p>
      <h1 className="h2">Letters to <em>future you</em></h1>
      <p className="lead">What are you hoping for? What&apos;s on your mind today? Seal it, and we&apos;ll keep it until it&apos;s time to open. It&apos;ll remember what you ordered today too.</p>

      <form className="card letter-form" onSubmit={seal}>
        <label className="field">Dear future me,
          <textarea className="input letter-paper" rows={7} maxLength={LETTER_MAX} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Right now I'm sitting by the window with a cappuccino, and…" required />
        </label>
        <div className="sum-row" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <span className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }} role="radiogroup" aria-label="Opens in">
            <span className="small muted">Opens in</span>
            {LETTER_MONTHS.map((m) => <button type="button" key={m} role="radio" aria-checked={months === m} className={`chip ${months === m ? "on" : ""}`} onClick={() => setMonths(m)}>{m === 12 ? "a year" : `${m} months`}</button>)}
          </span>
          <button className="btn btn-pink btn-sm" disabled={busy || body.trim().length < 3}>{busy ? "Sealing…" : "✉️ Seal it"}</button>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>{body.length}/{LETTER_MAX} · only you can read it, and not even you until it opens</p>
        {err && <p className="error small">{err}</p>}
      </form>

      {opened.length > 0 && <>
        <h2 className="h3" style={{ marginTop: "1.6rem" }}>Ready to open 💌</h2>
        <ul className="letters">
          {opened.map((l) => l.open && (
            <li key={l.id} className="card letter open">
              <button className="letter-head" onClick={() => setReading(reading === l.id ? null : l.id)} aria-expanded={reading === l.id}>
                <span>💌 Written {nice(l.written)}</span><span className="small muted">{reading === l.id ? "Fold it up" : "Open"}</span>
              </button>
              {reading === l.id && (
                <div className="letter-body">
                  <p style={{ whiteSpace: "pre-wrap" }}>{l.body}</p>
                  {l.ordered.length > 0 && <p className="small muted">That day you had: {l.ordered.join(", ")} ☕</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </>}
      {sealed.length > 0 && <>
        <h2 className="h3" style={{ marginTop: "1.6rem" }}>Still sealed</h2>
        <ul className="letters">
          {sealed.map((l) => !l.open && (
            <li key={l.id} className="card letter sealed">
              <span>✉️ Written {nice(l.written)}</span>
              <span className="small muted">opens {nice(l.openOn)} · {l.days} day{l.days === 1 ? "" : "s"} to go</span>
            </li>
          ))}
        </ul>
      </>}
    </div>
  );
}
