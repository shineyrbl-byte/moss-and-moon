"use client";
import "./page.css";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { CODE_LEN, CRACK_TRIES, DRINK_NAMES, DRINKS } from "@/lib/crack";

type G = {
  date: string; guesses: { guess: number[]; right: number; near: number }[]; done: boolean; won: boolean; triesLeft: number;
  code: number[] | null; grid: string | null; today: { played: number; won: number }; streak: number;
};

export default function CrackTheOrder() {
  const { toast } = useStore();
  const [g, setG] = useState<G | null>(null);
  const [cur, setCur] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch(`/api/crack?voter=${voterId()}`).then((r) => r.json()).then(setG).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  async function send() {
    if (cur.length !== CODE_LEN || busy) return;
    setBusy(true);
    const r = await fetch("/api/crack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guess: cur, voter: voterId() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    setG(d); setCur([]);
    if (d.won) toast(["First try?! 🤯", "Incredible!", "Brilliant!", "Lovely!", "Nice one!", "Good going!", "Phew!", "Just made it!"][d.guesses.length - 1] ?? "Cracked it!");
  }
  async function share() {
    if (!g?.grid) return;
    const text = `Crack the order ${g.date} · ${g.won ? `${g.guesses.length}/${CRACK_TRIES}` : `X/${CRACK_TRIES}`}\n${g.grid}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("Copied. Paste it anywhere 📋"); }
    } catch {}
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!g || g.done || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (/^[1-6]$/.test(e.key) && cur.length < CODE_LEN) setCur([...cur, Number(e.key) - 1]);
      else if (e.key === "Backspace") setCur(cur.slice(0, -1));
      else if (e.key === "Enter") send();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!g) return <div className="page"><p className="muted">The barista is writing something down…</p></div>;
  const rows = [...g.guesses.map((x) => ({ ...x, live: false })), ...(!g.done ? [{ guess: cur, right: -1, near: -1, live: true }] : [])];
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <h1 className="h2">Crack the <em>order</em></h1>
      <p className="small muted">The barista has written down a secret order of four drinks (a drink can appear more than once). You have {CRACK_TRIES} tries. After each guess: ✅ is a right drink in the right spot, 🔄 is a right drink in the wrong spot.</p>
      {g.streak > 1 && <p className="small">🔥 {g.streak} days cracked in a row</p>}
      <ol className="crack-rows" aria-label="Your guesses">
        {rows.map((r, i) => (
          <li key={i} className={r.live ? "live" : ""}>
            <span className="crack-n" aria-hidden="true">{i + 1}</span>
            <span className="crack-guess" role="img" aria-label={r.guess.map((d) => DRINK_NAMES[d]).join(", ") || "empty"}>
              {[...Array(CODE_LEN).keys()].map((k) => <span key={k} className="crack-slot" aria-hidden="true">{r.guess[k] !== undefined ? DRINKS[r.guess[k]] : ""}</span>)}
            </span>
            {!r.live && <span className="crack-marks" aria-label={`${r.right} right spot, ${r.near} wrong spot`}>{"✅".repeat(r.right)}{"🔄".repeat(r.near)}{r.right + r.near === 0 && <span className="muted">none</span>}</span>}
          </li>
        ))}
      </ol>
      {!g.done ? (
        <>
          <div className="crack-pad" role="group" aria-label="Drinks">
            {DRINKS.map((d, i) => <button key={d} className="sd-key" onClick={() => cur.length < CODE_LEN && setCur([...cur, i])} disabled={cur.length >= CODE_LEN} aria-label={DRINK_NAMES[i]}>{d}</button>)}
          </div>
          <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setCur(cur.slice(0, -1))} disabled={!cur.length}>⌫ Undo</button>
            <button className="btn btn-pink btn-sm" onClick={send} disabled={cur.length !== CODE_LEN || busy}>Guess ({g.triesLeft} left)</button>
          </div>
        </>
      ) : (
        <section className="card memory-done" aria-live="polite">
          <b>{g.won ? `Cracked in ${g.guesses.length}! 🎉` : "Not this time ☕"}</b>
          <p className="small" style={{ margin: 0 }}>The order was <span className="crack-answer" aria-label={g.code!.map((d) => DRINK_NAMES[d]).join(", ")}>{g.code!.map((d) => DRINKS[d]).join(" ")}</span></p>
          <button className="btn btn-ghost btn-sm" onClick={share}>Share my grid</button>
          <p className="tiny muted" style={{ margin: 0 }}>{g.today.played} played today · {g.today.won} cracked it. A new order tomorrow.</p>
        </section>
      )}
      <p className="tiny muted center" style={{ marginTop: "1rem" }}>Keyboard: 1 to 6 picks a drink ({DRINKS.map((d, i) => `${i + 1} ${d}`).join(", ")}), Backspace undoes, Enter guesses.</p>
    </div>
  );
}
