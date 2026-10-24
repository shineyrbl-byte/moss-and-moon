"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { defaultOptions } from "@/lib/pricing";

type P = { emoji: string; tries: string[]; ok: boolean; over: boolean; answer?: string; id?: string; price?: number; hints: string[] };
type S = { date: string; tries: number; puzzles: P[]; done: boolean; score: number; grid?: string; streak: number };

export default function GuessTheDish() {
  const { menu, add, toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [text, setText] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => { fetch(`/api/guess-dish?voter=${voterId()}`).then((r) => r.json()).then(setS).catch(() => {}); }, []);
  async function guess(e: React.FormEvent, i: number) {
    e.preventDefault();
    setBusy(i);
    const r = await fetch("/api/guess-dish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ i, guess: text[i] ?? "", voter: voterId() }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return toast(d.error ?? "That didn't work.");
    setS(d); setText({ ...text, [i]: "" });
    const p = d.puzzles[i] as P;
    toast(p.ok ? "🎉 Got it!" : p.over ? `It was ${p.answer}` : "Not quite. Here's a hint…");
  }
  async function share() {
    const t = `Moss & Moon · Guess the dish ${s!.date}\n${s!.grid} ${s!.score}/${s!.puzzles.length}`;
    try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast("Copied ✓"); } } catch {}
  }
  if (!s) return <div className="page"><p className="muted">Plating up…</p></div>;
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <h1 className="h2">Guess the <em>dish</em></h1>
      <p className="small muted">Each row of emoji spells out something on our menu. Three tries each, and a hint after every miss. Five new ones every day.</p>
      <ol className="dish-list">
        {s.puzzles.map((p, i) => (
          <li key={i} className={`card dish-card ${p.ok ? "ok" : p.over ? "missed" : ""}`}>
            <span className="dish-emoji" aria-label={`Puzzle ${i + 1}`}>{p.emoji}</span>
            {p.over ? (
              <div className="dish-answer">
                <b>{p.ok ? "✓ " : ""}{p.answer}</b>
                <span className="tiny muted">{p.ok ? `in ${p.tries.length} ${p.tries.length === 1 ? "try" : "tries"}` : "better luck tomorrow"}</span>
                {p.id && menu.some((m) => m.id === p.id) && <button className="link-btn tiny" onClick={() => { const m = menu.find((x) => x.id === p.id)!; add(m.id, defaultOptions(m), 1); toast(`${m.name} added 😋`); }}>Order one · ₹{p.price}</button>}
              </div>
            ) : (
              <form className="dish-form" onSubmit={(e) => guess(e, i)}>
                {p.hints.map((h) => <span key={h} className="tiny dish-hint">💡 {h}</span>)}
                {p.tries.length > 0 && <span className="tiny muted">Tried: {p.tries.join(", ")}</span>}
                <span className="row" style={{ gap: "0.4rem" }}>
                  <input className="input" aria-label={`Your guess for puzzle ${i + 1}`} maxLength={60} value={text[i] ?? ""} onChange={(e) => setText({ ...text, [i]: e.target.value })} placeholder="Dish name" />
                  <button className="btn btn-pink btn-sm" disabled={busy === i || (text[i] ?? "").trim().length < 3}>Guess</button>
                </span>
                <span className="tiny muted">{s.tries - p.tries.length} {s.tries - p.tries.length === 1 ? "try" : "tries"} left</span>
              </form>
            )}
          </li>
        ))}
      </ol>
      {s.done && (
        <section className="card center" style={{ padding: "1rem", marginTop: "1rem" }} aria-live="polite">
          <b>{s.score} of {s.puzzles.length} {s.score === s.puzzles.length ? "🏆 A full plate!" : s.score >= 3 ? "😋 Tasty work" : ""}</b>
          <p className="conn-share" style={{ fontSize: "1.6rem" }}>{s.grid}</p>
          <p className="small muted" style={{ margin: "0.3rem 0" }}>🔥 {s.streak} day streak</p>
          <button className="btn btn-pink btn-sm" onClick={share}>Share</button>
        </section>
      )}
    </div>
  );
}
