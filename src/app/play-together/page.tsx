"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import * as C from "@/lib/chess";
import * as G from "@/lib/gomoku";

type ChessState = { seat: 0 | 1; s: C.State; log: string[]; last: C.Move | null };
type GomokuState = { seat: 0 | 1; b: G.Cell[]; last: number | null; line: number[] | null };
type Room = { code: string; game: "chess" | "gomoku"; state: ChessState | GomokuState; version: number; joined: boolean };
const GLYPH: Record<string, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const fresh = (game: Room["game"]): Room["state"] => (game === "chess" ? { seat: 0, s: C.newGame(), log: [], last: null } : { seat: 0, b: G.empty(), last: null, line: null });
const saved = (code: string) => { try { return JSON.parse(localStorage.getItem(`mm-room-${code}`) ?? "null") as { token: string; seat: 0 | 1 } | null; } catch { return null; } };

export default function PlayTogether() {
  const { toast } = useStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<{ token: string; seat: 0 | 1 } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const roomRef = useRef(room);
  roomRef.current = room;

  async function api(body: Record<string, unknown>) {
    const r = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, d: await r.json() };
  }
  function enter(d: Room & { token: string; seat: 0 | 1 }) {
    try { localStorage.setItem(`mm-room-${d.code}`, JSON.stringify({ token: d.token, seat: d.seat })); } catch {}
    setMe({ token: d.token, seat: d.seat }); setRoom(d);
    history.replaceState(null, "", `/play-together?room=${d.code}`);
  }
  async function join(code: string) {
    const r = await api({ join: code, token: saved(code.toUpperCase())?.token });
    if (!r.ok) return toast(r.d.error);
    enter(r.d);
  }
  // A link with ?room= joins straight away
  useEffect(() => { const c = new URLSearchParams(location.search).get("room"); if (c) void join(c); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Check for the other player's moves
  useEffect(() => {
    if (!room) return;
    const id = setInterval(async () => {
      const cur = roomRef.current;
      if (!cur) return;
      const r = await fetch(`/api/rooms?code=${cur.code}`).then((x) => x.json()).catch(() => null);
      if (r && !r.error && r.version !== cur.version) setRoom(r);
    }, 1500);
    return () => clearInterval(id);
  }, [room?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(game: Room["game"]) {
    setBusy(true);
    const r = await api({ create: game, state: fresh(game) });
    setBusy(false);
    if (!r.ok) return toast(r.d.error);
    enter(r.d);
  }
  async function send(state: Room["state"], reset = false) {
    if (!room || !me) return;
    const prev = room;
    setRoom({ ...room, state, version: room.version }); // show it straight away
    const r = await api({ code: room.code, token: me.token, version: room.version, state, reset });
    if (!r.ok) { toast(r.d.error); setRoom(r.d.state ? r.d : prev); return; }
    setRoom(r.d);
  }
  async function shareLink() {
    if (!room) return;
    const url = `${location.origin}/play-together?room=${room.code}`;
    try { if (navigator.share) await navigator.share({ text: `Play me at ${room.game === "chess" ? "chess" : "five in a row"} on Moss & Moon: room ${room.code}`, url }); else { await navigator.clipboard.writeText(url); toast("Link copied 📋"); } } catch {}
  }

  if (!room || !me) {
    return (
      <div className="page" style={{ maxWidth: "34rem" }}>
        <p className="eyebrow">games corner</p>
        <h1 className="h2">Play <em>together</em></h1>
        <p className="small muted">Play a friend live, each on your own phone or computer. Start a room and send them the link, or type in the code they sent you. No sign-in needed.</p>
        <div className="pt-start">
          <button className="card pt-game" onClick={() => create("chess")} disabled={busy}><span aria-hidden="true">♟️</span><b>Café chess</b><small className="muted">You&apos;re white</small></button>
          <button className="card pt-game" onClick={() => create("gomoku")} disabled={busy}><span aria-hidden="true">⭕</span><b>Five in a row</b><small className="muted">You go first</small></button>
        </div>
        <div className="row" style={{ alignItems: "end", gap: "0.5rem", marginTop: "1.2rem", flexWrap: "wrap" }}>
          <label className="field" style={{ marginBottom: 0, maxWidth: "12rem" }}>Join with a code<input className="input" maxLength={5} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCDE" style={{ letterSpacing: "0.14em", textTransform: "uppercase" }} /></label>
          <button className="btn btn-pink btn-sm" onClick={() => join(joinCode)} disabled={joinCode.length < 5}>Join</button>
        </div>
        <p className="tiny muted" style={{ marginTop: "1rem" }}>Rooms close after a day without a move. Want to play on one device instead? Every board game has a 👥 Two players button.</p>
      </div>
    );
  }

  const mine = room.state.seat === me.seat;
  const who = (seat: number) => (seat === me.seat ? "You" : "Your friend");
  let board: React.ReactNode = null, status = "";
  if (room.game === "chess") {
    const st = room.state as ChessState;
    const legal = C.moves(st.s), res = C.result(st.s, legal);
    const myColor: C.Color = me.seat === 0 ? "w" : "b";
    status = res.over ? (res.why === "checkmate" ? (res.winner === myColor ? "Checkmate: you win! 🎉" : "Checkmate: your friend wins") : "A draw") : !room.joined ? "Waiting for your friend to join…" : mine ? (C.inCheck(st.s) ? "You're in check!" : "Your move") : "Their move…";
    const targets = new Set(sel === null ? [] : legal.filter((m) => m.from === sel).map((m) => m.to));
    const order = [...Array(64).keys()]; if (myColor === "b") order.reverse();
    const tap = (i: number) => {
      if (!mine || res.over || !room.joined) return;
      if (sel !== null) {
        const ms = legal.filter((m) => m.from === sel && m.to === i);
        if (ms.length) { const m = ms.find((x) => !x.promo || x.promo === "q")!; setSel(null); void send({ seat: me.seat === 0 ? 1 : 0, s: C.play(st.s, m), log: [...st.log, C.san(st.s, m)], last: m }); return; }
      }
      const p = st.s.b[i];
      setSel(p && C.colorOf(p) === myColor ? (sel === i ? null : i) : null);
    };
    board = (
      <>
        <div className="cc-board" role="grid" aria-label="Chess board">
          {order.map((i) => { const p = st.s.b[i], dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1, last = st.last && (st.last.from === i || st.last.to === i); return (
            <button key={i} className={`cc-sq ${dark ? "dark" : "light"} ${sel === i ? "sel" : ""} ${targets.has(i) ? (p ? "hit" : "dot") : ""} ${last ? "last" : ""}`} onClick={() => tap(i)} aria-label={`${C.name(i)}${p ? `: ${C.colorOf(p) === "w" ? "white" : "black"} piece` : ""}`}>
              {p && <span className={`cc-piece ${C.colorOf(p)}`} aria-hidden="true">{GLYPH[p.toUpperCase()]}</span>}
            </button>); })}
        </div>
        {st.log.length > 0 && <ol className="cc-log">{st.log.filter((_, k) => k % 2 === 0).map((w, k) => <li key={k}><span>{w}</span><span>{st.log[2 * k + 1] ?? ""}</span></li>)}</ol>}
        <p className="tiny muted">Pawns that reach the far side become queens.</p>
      </>
    );
  } else {
    const st = room.state as GomokuState;
    const winner = st.line ? st.b[st.line[0]] : null, full = G.full(st.b);
    status = winner !== null ? (winner === me.seat ? "Five in a row: you win! 🎉" : "Your friend got five in a row") : full ? "A draw" : !room.joined ? "Waiting for your friend to join…" : mine ? "Your cup" : "Their move…";
    const win = new Set(st.line ?? []);
    const tap = (i: number) => {
      if (!mine || winner !== null || full || !room.joined) return;
      const b = G.play(st.b, i, me.seat);
      if (b) void send({ seat: me.seat === 0 ? 1 : 0, b, last: i, line: G.winLine(b, i) });
    };
    board = (
      <div className="fr-board" style={{ ["--n" as string]: G.N }} role="grid" aria-label="Tablecloth">
        {st.b.map((x, i) => <button key={i} className={`fr-cell ${win.has(i) ? "win" : ""} ${st.last === i ? "last" : ""}`} onClick={() => tap(i)} aria-label={`Square ${i + 1}: ${x === null ? "empty" : x === me.seat ? "your cup" : "their cup"}`}>{x !== null && <i className={`fr-cup ${x ? "them" : "you"}`} aria-hidden="true" />}</button>)}
      </div>
    );
  }
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">live · room {room.code}</p>
      <h1 className="h2">{room.game === "chess" ? "Café chess" : "Five in a row"} <em>together</em></h1>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="pt-code">{room.code}</span>
        <button className="btn btn-pink btn-sm" onClick={shareLink}>📤 Send the link</button>
        {me.seat === 0 && <button className="btn btn-ghost btn-sm" onClick={() => send(fresh(room.game), true)}>New game</button>}
        <Link className="small" href="/play-together" onClick={() => { setRoom(null); setMe(null); }}>Leave</Link>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.8rem 0 0.4rem" }}><b>{status}</b>{room.joined ? <span className="muted"> · {who(room.state.seat)} to play</span> : null}</p>
      {board}
      <p className="tiny muted">Moves show up on the other device within a couple of seconds. Keep this page open while you play.</p>
    </div>
  );
}
