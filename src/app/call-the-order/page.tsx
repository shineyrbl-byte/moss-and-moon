"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { LIVES, isDone, matchTicket, norm, orderText, spawnMs, travelMs, type Ticket } from "@/lib/callOrder";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
const BEST = "mm-typing-best";
type Run = { tickets: Ticket[]; score: number; lives: number; nextAt: number; id: number; over: boolean };

export default function CallTheOrder() {
  const { toast } = useStore();
  const [run, setRun] = useState<Run | null>(null);
  const [playing, setPlaying] = useState(false);
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(0);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pausedAt = useRef<number | null>(null);
  useEffect(() => {
    try { setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/arcade?game=typing&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  // The game clock: new tickets arrive, old ones run out
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const frame = () => {
      const t = Date.now();
      setNow(t);
      setRun((r) => {
        if (!r || r.over) return r;
        let { tickets, lives, nextAt, id } = r;
        const late = tickets.filter((k) => t - k.born >= k.travel);
        if (late.length) { tickets = tickets.filter((k) => !late.includes(k)); lives -= late.length; }
        if (t >= nextAt && tickets.length < 5) {
          tickets = [...tickets, { id: id + 1, text: orderText(r.score, Math.random), born: t, travel: travelMs(r.score) }];
          id += 1; nextAt = t + spawnMs(r.score);
        }
        if (lives <= 0) return { ...r, tickets, lives: 0, over: true };
        if (tickets === r.tickets && lives === r.lives) return r;
        return { ...r, tickets, lives, nextAt, id };
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  useEffect(() => {
    if (run?.over && playing) {
      setPlaying(false);
      if (run.score > best) { setBest(run.score); try { localStorage.setItem(BEST, String(run.score)); } catch {} if (run.score) toast(`New best: ${run.score} orders! ☕`); }
    }
  }, [run, playing, best, toast]);
  // Pause when you switch away, and give back the time you were gone
  useEffect(() => {
    const h = () => {
      if (document.hidden && playing) { pausedAt.current = Date.now(); setPlaying(false); }
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [playing]);
  function go() {
    const t = Date.now();
    if (pausedAt.current && run && !run.over) {
      const gap = t - pausedAt.current;
      setRun({ ...run, nextAt: run.nextAt + gap, tickets: run.tickets.map((k) => ({ ...k, born: k.born + gap })) });
    } else {
      setRun({ tickets: [], score: 0, lives: LIVES, nextAt: t + 400, id: 0, over: false });
      setSaved(false);
    }
    pausedAt.current = null;
    setTyped(""); setNow(t); setPlaying(true);
    setTimeout(() => input.current?.focus(), 30);
  }
  function type(v: string) {
    if (!run || run.over || !playing) return;
    const match = matchTicket(run.tickets, v);
    if (match && isDone(match, v)) {
      setRun({ ...run, tickets: run.tickets.filter((k) => k.id !== match.id), score: run.score + 1 });
      setTyped("");
      return;
    }
    setTyped(v);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "typing", score: run?.score, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const target = run ? matchTicket(run.tickets, typed) : null;
  const wrong = !!typed.trim() && !target;
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Call the <em>order</em></h1>
      <p className="small muted">Orders come in on tickets. Type one out before its time runs out to send it to the bar. Capitals and commas don&apos;t matter. Miss three and the shift&apos;s over. The orders get longer as you go.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Orders <b>{run?.score ?? 0}</b></span><span aria-label={`${run?.lives ?? LIVES} lives left`}>{"❤️".repeat(run?.lives ?? LIVES)}{"🤍".repeat(LIVES - (run?.lives ?? LIVES))}</span><span>Best <b>{best}</b></span>
      </div>
      <input ref={input} className={`input typing-input ${wrong ? "wrong" : ""}`} value={typed} onChange={(e) => type(e.target.value)} disabled={!playing}
        autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder={playing ? "Type an order…" : ""} aria-label="Type the order" />
      <div className="typing-rail" aria-live="polite">
        {run?.tickets.map((k) => {
          const pct = Math.max(0, 1 - (now - k.born) / k.travel);
          const on = target?.id === k.id, n = on ? norm(typed).length : 0;
          return (
            <div key={k.id} className={`typing-ticket ${on ? "on" : ""} ${pct < 0.25 ? "late" : ""}`}>
              <span className="typing-text">{on ? <><b>{norm(k.text).slice(0, n)}</b>{norm(k.text).slice(n)}</> : k.text}</span>
              <span className="typing-fuse" style={{ width: `${pct * 100}%` }} />
            </div>
          );
        })}
        {!playing && (
          <div className="typing-over">
            {run?.over ? <><b>Shift over! {run.score} order{run.score === 1 ? "" : "s"} sent</b><button className="btn btn-pink btn-sm" onClick={go}>Another shift</button></>
              : <button className="btn btn-pink" onClick={go}>{pausedAt.current ? "▶ Carry on" : "▶ Start the shift"}</button>}
          </div>
        )}
      </div>
      {run?.over && run.score > 0 && !saved && (
        <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem", marginTop: "0.8rem" }}>
          <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
        </div>
      )}
      {saved && <p className="small center">Saved ✓</p>}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s best</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No scores yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </div>
  );
}
