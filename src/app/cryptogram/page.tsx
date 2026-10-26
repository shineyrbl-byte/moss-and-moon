"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { ALPHABET, HINT_MS, cipherFor, codeLetters, decode, guess, hintLetter, isFilled, isSolved } from "@/lib/cryptogram";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-cipher";
const isLetter = (c: string) => ALPHABET.includes(c);

export default function Cryptogram() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const p = useMemo(() => (date ? cipherFor(date) : null), [date]);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    let s: { date?: string; guesses?: Record<string, string>; locked?: Record<string, string>; start?: number; extra?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    const given = cipherFor(d).given;
    if (s?.date === d) {
      setGuesses({ ...s.guesses, ...given }); setLocked({ ...s.locked, ...given }); setStart(s.start ?? null); setExtra(s.extra ?? 0); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved);
    } else { setGuesses(given); setLocked(given); }
    setNow(Date.now());
    fetch(`/api/daily-scores?game=cipher&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (!rp.on && date) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, guesses, locked, start, extra, doneMs, saved })); } catch {} }, [date, guesses, locked, start, extra, doneMs, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: guesses, setState: setGuesses, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);

  const letters = useMemo(() => (p ? codeLetters(p) : []), [p]);
  function setGuess(code: string, plain: string | null, lock = false) {
    if (!p || doneMs !== null) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const nextLocked = lock ? { ...locked, [code]: plain! } : locked;
    // A hint wipes any wrong guess that used the same letter
    const base = lock ? guess(guesses, code, plain) : guesses;
    const next = lock ? { ...base, [code]: plain! } : guess(guesses, code, plain, locked);
    if (lock) setLocked(nextLocked);
    setGuesses(next);
    if (isFilled(p, next)) {
      if (isSolved(p, next)) { setDoneMs(Date.now() - t + extra + (lock ? HINT_MS : 0)); if (!lock && extra === 0) addFlag("cipher-no-hints"); setSel(null); toast("Cracked it! 🔓🎉"); }
      else if (!lock) toast("Every letter's filled, but something's not right yet.");
    }
    // Move on to the next empty letter, in reading order
    if (plain && !lock) {
      const order = [...p.code].filter(isLetter);
      const at = order.indexOf(code);
      const nxt = [...order.slice(at + 1), ...order.slice(0, at)].find((c) => !next[c]);
      setSel(nxt ?? code);
    }
  }
  function hint() {
    if (!p) return;
    const c = hintLetter(p, guesses, sel);
    if (!c) return;
    setExtra(extra + HINT_MS); setGuess(c, decode(p, c), true); setSel(c);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!sel || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).tagName === "INPUT") return;
      const k = e.key.toUpperCase();
      if (k.length === 1 && isLetter(k)) { e.preventDefault(); setGuess(sel, k); }
      else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); setGuess(sel, null); }
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const i = letters.indexOf(sel), n = letters.length;
        setSel(letters[(i + (e.key === "ArrowRight" ? 1 : n - 1)) % n]);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  // Keyboard focus follows the selected letter, so the ring never sits on the wrong one
  useEffect(() => {
    const a = document.activeElement as HTMLElement | null;
    if (sel && a?.classList.contains("cipher-cell") && a.dataset.code !== sel) document.querySelector<HTMLElement>(`.cipher-cell[data-code="${sel}"]`)?.focus({ preventScroll: true });
  }, [sel]);
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "cipher", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!p) return <div className="page"><p className="muted">Writing the code…</p></div>;
  const elapsed = doneMs ?? (start ? now - start + extra : 0);
  const used = new Set(Object.values(guesses));
  const done = doneMs !== null;
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/cryptogram" />
      <h1 className="h2">Café <em>cryptogram</em></h1>
      <p className="small muted">A saying from the café chalkboard, in code: every letter has been swapped for a different one. Tap a letter and type what you think it really is. The same code letter is the same real letter everywhere. One is given to start you off.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span><span>{letters.filter((c) => guesses[c]).length}/{letters.length} letters</span></span>
      </div>
      <div className={`cipher ${done ? "solved" : ""}`} aria-label="The coded saying">
        {p.code.split(" ").map((word, w) => (
          <span key={w} className="cipher-word">
            {[...word].map((c, i) => isLetter(c) ? (
              <button key={i} data-code={c} className={`cipher-cell ${sel === c ? "on" : ""} ${locked[c] ? "given" : ""}`} onClick={() => setSel(c)} disabled={done}
                aria-label={`Code letter ${c}${guesses[c] ? `, your guess ${guesses[c]}` : ", empty"}`}>
                <b>{guesses[c] ?? ""}</b><span>{c}</span>
              </button>
            ) : <span key={i} className="cipher-punct">{c}</span>)}
          </span>
        ))}
      </div>
      {!done && (
        <div className="cipher-keys" role="group" aria-label="Letters">
          {[...ALPHABET].map((k) => (
            <button key={k} className={`cipher-key ${used.has(k) ? "used" : ""}`} disabled={!sel} onClick={() => sel && setGuess(sel, k)}>{k}</button>
          ))}
          <button className="cipher-key wide" disabled={!sel || !!(sel && locked[sel])} onClick={() => sel && setGuess(sel, null)} aria-label="Clear this letter">⌫</button>
        </div>
      )}
      {!done && <p className="tiny muted center">{sel ? <>Picking for <b>{sel}</b>. Faded keys are already used somewhere.</> : "Tap a letter in the saying to start."}</p>}
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Cracked in {clock(doneMs)} 🎉</b>
          <p className="small" style={{ margin: 0 }}>&ldquo;{p.text}&rdquo;</p>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new saying tomorrow.</p>
          <ShareResult title="Café cryptogram" date={date} score={doneMs} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
          <p className="tiny muted">Each hint adds {HINT_MS / 1000} seconds.</p>
        </section>
      )}
    </div>
  );
}
