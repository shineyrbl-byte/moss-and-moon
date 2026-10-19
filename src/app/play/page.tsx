"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import DrinkCup from "@/components/DrinkCup";
import { GAME_MILKS, GAME_SIZES, MISTAKE_PENALTY, gameChoices, mistakes, newOrder, playableDrinks, points, type Build, type GameOrder } from "@/lib/gameOrders";

const ROUND = 60;
const START: Build = { size: "regular", temp: "hot", milk: "whole", shot: false };
const LABEL: Record<string, string> = { small: "Small", regular: "Regular", large: "Large", hot: "Hot", iced: "Iced", whole: "Whole milk", oat: "Oat milk", almond: "Almond milk", soy: "Soy milk", none: "No milk" };
type Row = { name: string; score: number; served: number };

export default function Play() {
  const { menu } = useStore();
  const drinks = useMemo(() => playableDrinks(menu), [menu]);
  const [phase, setPhase] = useState<"ready" | "playing" | "over">("ready");
  const [left, setLeft] = useState(ROUND);
  const [order, setOrder] = useState<GameOrder | null>(null);
  const [build, setBuild] = useState<Build>(START);
  const [score, setScore] = useState(0);
  const [served, setServed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<{ week: Row[]; allTime: Row[] } | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const orderAt = useRef(0);
  const endAt = useRef(0);

  useEffect(() => {
    try { setBest(Number(localStorage.getItem("mm-game-best")) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch("/api/game").then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);

  const next = useCallback(() => {
    setOrder(newOrder(drinks));
    setBuild(START);
    orderAt.current = Date.now();
  }, [drinks]);

  function start() {
    setScore(0); setServed(0); setStreak(0); setFlash(null); setSaved(null);
    endAt.current = Date.now() + ROUND * 1000;
    setLeft(ROUND);
    setPhase("playing");
    next();
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setPhase("over");
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "over") return;
    if (score > best) { setBest(score); try { localStorage.setItem("mm-game-best", String(score)); } catch {} }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = order ? menu.find((m) => m.id === order.itemId) : undefined;
  const c = item ? gameChoices(item) : { temp: true, milk: true, shot: true };
  // A cold drink is always iced and a no-milk drink has none, so the cup matches what's possible
  const effective: Build = { ...build, temp: c.temp ? build.temp : "iced", milk: c.milk ? build.milk : "none", shot: c.shot ? build.shot : false };

  function serve() {
    if (!order || phase !== "playing") return;
    const wrong = mistakes(order.want, effective);
    setServed((n) => n + 1);
    if (!wrong.length) {
      const p = points((Date.now() - orderAt.current) / 1000, streak);
      setScore((s) => s + p);
      setStreak((s) => s + 1);
      setFlash({ ok: true, text: `+${p} ✿ ${order.guest} loves it` });
    } else {
      setScore((s) => Math.max(0, s - MISTAKE_PENALTY));
      setStreak(0);
      setFlash({ ok: false, text: `−${MISTAKE_PENALTY} · they wanted ${wrong.map((k) => (k === "shot" ? (order.want.shot ? "an extra shot" : "no extra shot") : LABEL[String(order.want[k])])).join(", ")}` });
    }
    next();
  }

  // Keyboard: Enter or Space serves
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (phase === "playing" && (e.key === "Enter" || e.key === " ") && (e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); serve(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, score, served }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setSaved(j.rank); setBoard({ week: j.week, allTime: j.allTime }); }
  }

  const chip = <K extends keyof Build>(k: K, v: Build[K], text: string) => (
    <button key={String(v)} type="button" role="radio" aria-checked={build[k] === v} className={`chip ${build[k] === v ? "on" : ""}`} onClick={() => setBuild((b) => ({ ...b, [k]: v }))}>{text}</button>
  );

  return (
    <div className="page narrow game">
      <p className="eyebrow">a little game</p>
      <h1 className="h2">Barista <em>rush</em></h1>

      {phase === "ready" && (
        <section className="card center">
          <p className="lead">Orders come in. Make each drink exactly as asked (size, hot or iced, milk, extra shot) and hit <b>Serve</b>. Faster means more points, and a streak of perfect drinks multiplies them. You have {ROUND} seconds.</p>
          {best > 0 && <p className="small muted">Your best: {best}</p>}
          <button className="btn btn-pink" onClick={start} disabled={!drinks.length}>▶︎ Start</button>
        </section>
      )}

      {phase === "playing" && order && item && (
        <>
          <div className="game-hud" aria-live="off">
            <span>⏱ <b>{left}s</b></span>
            <span>⭐ <b>{score}</b></span>
            <span>🔥 ×{Math.min(2, 1 + streak * 0.1).toFixed(1)}</span>
          </div>
          <section className="card game-ticket" aria-live="polite">
            <small className="muted">Order for {order.guest}</small>
            <h2 className="h3" style={{ margin: "0.2rem 0" }}>{item.name}</h2>
            <p className="small"><b>{LABEL[order.want.size]}</b>{c.temp && <> · <b>{LABEL[order.want.temp]}</b></>}{c.milk && <> · <b>{LABEL[order.want.milk]}</b></>}{c.shot && order.want.shot && <> · <b>+1 shot</b></>}</p>
          </section>
          {flash && <p className={`small game-flash ${flash.ok ? "ok" : "bad"}`}>{flash.text}</p>}
          <section className="card game-bench">
            <div className="game-cup"><DrinkCup item={item} opts={effective} /></div>
            <div className="game-controls">
              <div className="chips" role="radiogroup" aria-label="Size">{GAME_SIZES.map((v) => chip("size", v, LABEL[v]))}</div>
              {c.temp && <div className="chips" role="radiogroup" aria-label="Hot or iced">{chip("temp", "hot", "Hot")}{chip("temp", "iced", "Iced")}</div>}
              {c.milk && <div className="chips" role="radiogroup" aria-label="Milk">{GAME_MILKS.map((v) => chip("milk", v, LABEL[v].replace(" milk", "")))}</div>}
              {c.shot && <div className="chips"><button type="button" aria-pressed={build.shot} className={`chip ${build.shot ? "on" : ""}`} onClick={() => setBuild((b) => ({ ...b, shot: !b.shot }))}>+1 shot</button></div>}
              <button className="btn btn-pink full" onClick={serve}>Serve ✿</button>
            </div>
          </section>
        </>
      )}

      {phase === "over" && (
        <section className="card center">
          <span style={{ fontSize: "2.6rem" }}>{score >= best && score > 0 ? "🏆" : "☕"}</span>
          <h2 className="h3">Time! You scored {score}</h2>
          <p className="small muted">{served} drink{served === 1 ? "" : "s"} served{score >= best && score > 0 ? " · a new personal best!" : ` · your best is ${best}`}</p>
          {saved === null ? (
            <form onSubmit={submit} className="row" style={{ gap: "0.5rem", justifyContent: "center", alignItems: "flex-end", marginTop: "0.6rem" }}>
              <label className="field small" style={{ maxWidth: 200 }}>Your name for the board<input className="input" maxLength={16} required value={name} onChange={(e) => setName(e.target.value)} /></label>
              <button className="btn btn-ghost btn-sm">Save score</button>
            </form>
          ) : <p className="reward-banner small">Saved! You&apos;re #{saved} of all time.</p>}
          <button className="btn btn-pink" style={{ marginTop: "0.8rem" }} onClick={start}>Play again</button>
        </section>
      )}

      {board && (board.allTime.length > 0) && (
        <section className="game-boards">
          {(["week", "allTime"] as const).map((k) => (
            <div key={k} className="card">
              <h3 style={{ fontSize: "1.05rem" }}>{k === "week" ? "🗓 This week" : "🏆 All time"}</h3>
              <ol className="small">{board[k].map((r, i) => <li key={i}><span>{r.name}</span><b>{r.score}</b></li>)}</ol>
              {!board[k].length && <p className="small muted">No scores yet.</p>}
            </div>
          ))}
        </section>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>Tip: press Enter to serve. <Link href="/#menu">Want the real thing? ☕</Link></p>
    </div>
  );
}
