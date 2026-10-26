"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import HiddenMoon from "@/components/HiddenMoon";

type T = { date: string; q: string; choices: string[]; mine?: { choice: number; correct: boolean; answer: number; why: string }; answered: number; right: number; streak: number; best: number };

export default function Trivia() {
  const [t, setT] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { fetch(`/api/trivia?voter=${voterId()}`).then((r) => r.json()).then(setT).catch(() => setErr("Couldn't load today's question.")); }, []);
  async function answer(choice: number) {
    setBusy(true);
    const r = await fetch("/api/trivia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice, voter: voterId() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(d.error);
    setT(d);
  }
  const share = async () => {
    const text = `☕ Moss & Moon trivia ${t!.date}: ${t!.mine!.correct ? "got it ✅" : "missed it ❌"}${t!.streak > 1 ? ` · 🔥 ${t!.streak}-day streak` : ""}`;
    try { if (navigator.share) await navigator.share({ text, url: location.href }); else { await navigator.clipboard.writeText(`${text} ${location.href}`); setErr("Copied ✿"); } } catch {}
  };
  if (!t) return <div className="page narrow"><p className="muted">{err || "Brewing today's question…"}</p></div>;
  const pct = t.answered ? Math.round((t.right / t.answered) * 100) : 0;
  return (
    <div className="page" style={{ maxWidth: "38rem" }}>
      <p className="eyebrow">{new Date(`${t.date}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1 className="h2">Daily <em>trivia</em></h1>
      <p className="lead">One question a day about coffee, tea and Goan food. Same question for everyone.</p>
      <section className="card trivia" aria-live="polite">
        <h2 className="trivia-q">{t.q}</h2>
        <div className="trivia-choices">
          {t.choices.map((c, i) => {
            const st = t.mine ? (i === t.mine.answer ? "right" : i === t.mine.choice ? "wrong" : "") : "";
            return <button key={i} className={`trivia-choice ${st}`} disabled={!!t.mine || busy} onClick={() => answer(i)}>{st === "right" ? "✓ " : st === "wrong" ? "✗ " : ""}{c}</button>;
          })}
        </div>
        {t.mine && (
          <div className="trivia-after">
            <b>{t.mine.correct ? "Spot on! 🎉" : "Not quite ✿"}</b> <HiddenMoon id="m-trivia-9x" />
            <p className="small" style={{ margin: "0.3rem 0" }}>{t.mine.why}</p>
            <p className="small muted" style={{ margin: 0 }}>{pct}% of {t.answered} {t.answered === 1 ? "person" : "people"} got it today · come back tomorrow for a new one</p>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: "0.6rem" }} onClick={share}>Share</button>
          </div>
        )}
        {err && <p className="small muted">{err}</p>}
      </section>
      <div className="sum-row" style={{ marginTop: "1rem" }}>
        <span>🔥 <b>{t.streak}</b> day{t.streak === 1 ? "" : "s"} in a row</span>
        <span className="small muted">Best: {t.best}</span>
      </div>
      <p className="small muted">Answer 7 days in a row while <Link href="/account">signed in</Link> for the 🧠 Quiz whiz badge.</p>
    </div>
  );
}
