"use client";
import "../reversi/page.css";
import "../draughts/page.css";
import "../connect-four/page.css";
import "../terrace-backgammon/page.css";
import "../cafe-ludo/page.css";
import "../cafe-poker/page.css";
import "../cafe-letters/page.css";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import * as C from "@/lib/chess";
import * as G from "@/lib/gomoku";
import * as C4 from "@/lib/connect4";
import * as BG from "@/lib/backgammon";
import { LiveBackgammon, LiveDraughts, LiveFour, LiveReversi, freshBg, freshDraughts, freshFour, freshReversi, type BgState, type DraughtsState, type FourState, type ReversiState } from "@/components/LiveBoards";
import { LiveDominoes, LiveLetters, LiveLudo, LivePoker, freshLudo, roomOver, type LudoState } from "@/components/LiveBoards2";

type ChessState = { seat: 0 | 1; s: C.State; log: string[]; last: C.Move | null };
type GomokuState = { seat: 0 | 1; b: G.Cell[]; last: number | null; line: number[] | null };
type Game = "chess" | "gomoku" | "reversi" | "draughts" | "connect4" | "backgammon" | "ludo" | "poker" | "dominoes" | "letters";
type Room = { code: string; game: Game; state: Record<string, unknown> & { seat: number }; version: number; joined: boolean; players: number; seats: number; names: string[]; reactions: { seat: number; emoji: string; at: number }[]; rematch: number[]; server: boolean };
const GAMES: { id: Game; emoji: string; title: string; note: string }[] = [
  { id: "chess", emoji: "♟️", title: "Café chess", note: "You're white" },
  { id: "gomoku", emoji: "⭕", title: "Five in a row", note: "You go first" },
  { id: "reversi", emoji: "⚫", title: "Bean reversi", note: "You're the dark beans" },
  { id: "draughts", emoji: "🔴", title: "Café draughts", note: "You're pink" },
  { id: "connect4", emoji: "🟡", title: "Connect Four", note: "You're red" },
  { id: "backgammon", emoji: "🎲", title: "Backgammon", note: "You're pink" },
  { id: "ludo", emoji: "🟢", title: "Café ludo", note: "2 to 4 players" },
  { id: "poker", emoji: "🃏", title: "Café poker", note: "2 to 4, chips only" },
  { id: "dominoes", emoji: "🁫", title: "Café dominoes", note: "First to 50" },
  { id: "letters", emoji: "🔤", title: "Café letters", note: "Words of 2 to 5" },
];
const REACTIONS = ["👏", "😂", "😮", "😅", "🔥", "☕"];
const titleOf = (g: Game) => GAMES.find((x) => x.id === g)!.title;
const GLYPH: Record<string, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const SERVER = new Set<Game>(["poker", "dominoes", "letters"]);
const fresh = (game: Game): Record<string, unknown> =>
  game === "chess" ? { seat: 0, s: C.newGame(), log: [], last: null } : game === "gomoku" ? { seat: 0, b: G.empty(), last: null, line: null }
  : game === "reversi" ? freshReversi() : game === "draughts" ? freshDraughts() : game === "connect4" ? freshFour() : game === "backgammon" ? freshBg() : game === "ludo" ? freshLudo() : {};
const saved = (code: string) => { try { return JSON.parse(localStorage.getItem(`mm-room-${code}`) ?? "null") as { token: string; seat: number } | null; } catch { return null; } };
/** Has the game in this room finished? (shows the rematch button) */
function finished(room: Room) {
  const st = room.state;
  if (roomOver(room.game, st)) return true;
  if (room.game === "chess") { const s = (st as unknown as ChessState).s; return C.result(s, C.moves(s)).over; }
  if (room.game === "gomoku") { const s = st as unknown as GomokuState; return !!s.line || G.full(s.b); }
  if (room.game === "reversi") return !!(st as unknown as ReversiState).over;
  if (room.game === "draughts") return !!(st as unknown as DraughtsState).result;
  if (room.game === "connect4") { const b = (st as unknown as FourState).b; return !!C4.winner(b) || C4.isFull(b); }
  if (room.game === "backgammon") return BG.winner((st as unknown as BgState).s) !== null;
  return false;
}

export default function PlayTogether() {
  const { toast } = useStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<{ token: string; seat: number } | null>(null);
  const [watching, setWatching] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const roomRef = useRef(room), meRef = useRef(me);
  roomRef.current = room; meRef.current = me;
  useEffect(() => { try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);

  async function api(body: Record<string, unknown>) {
    const r = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, d: await r.json() };
  }
  const rememberName = () => { try { if (name) localStorage.setItem("mm-game-name", name); } catch {} };
  // On a link, the join runs before the name box has loaded, so read the saved name directly
  const myName = () => { if (name) return name; try { return localStorage.getItem("mm-game-name") ?? ""; } catch { return ""; } };
  function enter(d: Room & { token: string; seat: number }) {
    try { localStorage.setItem(`mm-room-${d.code}`, JSON.stringify({ token: d.token, seat: d.seat })); } catch {}
    setMe({ token: d.token, seat: d.seat }); setRoom(d); setWatching(false);
    history.replaceState(null, "", `/play-together?room=${d.code}`);
  }
  async function watch(code: string) {
    const r = await fetch(`/api/rooms?code=${code}`).then((x) => x.json()).catch(() => null);
    if (!r || r.error) return toast(r?.error ?? "We couldn't find that room.");
    setMe(null); setRoom(r); setWatching(true);
    history.replaceState(null, "", `/play-together?room=${r.code}&watch=1`);
  }
  async function join(code: string) {
    rememberName();
    const r = await api({ join: code, token: saved(code.toUpperCase())?.token, name: myName() });
    if (!r.ok) { if (r.d.full) { toast(r.d.error); return watch(code.toUpperCase()); } return toast(r.d.error); }
    enter(r.d);
  }
  // A link with ?room= joins straight away (or just watches, with &watch=1)
  useEffect(() => { const q = new URLSearchParams(location.search), c = q.get("room"); if (c) void (q.get("watch") ? watch(c) : join(c)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep up with the other players' moves
  useEffect(() => {
    if (!room) return;
    const id = setInterval(async () => {
      const cur = roomRef.current;
      if (!cur) return;
      const r = await fetch(`/api/rooms?code=${cur.code}${meRef.current ? `&token=${meRef.current.token}` : ""}`).then((x) => x.json()).catch(() => null);
      if (r && !r.error && r.version !== cur.version) setRoom(r);
    }, 1500);
    return () => clearInterval(id);
  }, [room?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(game: Game) {
    setBusy(true); rememberName();
    const r = await api({ create: game, state: fresh(game), name: myName() });
    setBusy(false);
    if (!r.ok) return toast(r.d.error);
    enter(r.d);
  }
  async function send(state: Record<string, unknown>, reset = false) {
    if (!room || !me) return;
    const prev = room;
    setRoom({ ...room, state: state as Room["state"] }); // show it straight away
    const r = await api({ code: room.code, token: me.token, version: room.version, state, reset });
    if (!r.ok) { toast(r.d.error); setRoom(r.d.state ? r.d : prev); return; }
    setRoom(r.d);
  }
  async function act(action: Record<string, unknown>) {
    if (!room || !me) return;
    const r = await api({ code: room.code, token: me.token, action });
    if (!r.ok) toast(r.d.error);
    if (r.d.state) setRoom(r.d);
  }
  async function react(emoji: string) { if (room && me) { const r = await api({ code: room.code, token: me.token, react: emoji }); if (r.ok) setRoom(r.d); } }
  async function rematch() { if (room && me) { const r = await api({ code: room.code, token: me.token, rematch: true }); if (r.ok) setRoom(r.d); else toast(r.d.error); } }
  async function shareLink(watchLink = false) {
    if (!room) return;
    const url = `${location.origin}/play-together?room=${room.code}${watchLink ? "&watch=1" : ""}`;
    const text = watchLink ? `Watch our ${titleOf(room.game)} game on Moss & Moon` : `Play me at ${titleOf(room.game)} on Moss & Moon: room ${room.code}`;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(url); toast("Link copied 📋"); } } catch {}
  }

  if (!room) {
    return (
      <div className="page" style={{ maxWidth: "40rem" }}>
        <p className="eyebrow">games corner</p>
        <h1 className="h2">Play <em>together</em></h1>
        <p className="small muted">Play friends live, each on your own phone or computer. Start a room and send them the link, or type in the code they sent you. No sign-in needed. In poker, dominoes and letters, the café keeps the cards, so nobody can peek at your hand.</p>
        <label className="field" style={{ maxWidth: "14rem" }}>Your name at the table<input className="input" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
        <div className="pt-start">
          {GAMES.map((g) => <button key={g.id} className="card pt-game" onClick={() => create(g.id)} disabled={busy}><span aria-hidden="true">{g.emoji}</span><b>{g.title}</b><small className="muted">{g.note}</small></button>)}
        </div>
        <div className="row" style={{ alignItems: "end", gap: "0.5rem", marginTop: "1.2rem", flexWrap: "wrap" }}>
          <label className="field" style={{ marginBottom: 0, maxWidth: "12rem" }}>Join with a code<input className="input" maxLength={5} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCDE" style={{ letterSpacing: "0.14em", textTransform: "uppercase" }} /></label>
          <button className="btn btn-pink btn-sm" onClick={() => join(joinCode)} disabled={joinCode.length < 5}>Join</button>
          <button className="btn btn-ghost btn-sm" onClick={() => watch(joinCode)} disabled={joinCode.length < 5}>Just watch</button>
        </div>
        <p className="tiny muted" style={{ marginTop: "1rem" }}>Rooms close after a day without a move. Want to play on one device instead? Every board game has a 👥 Two players button.</p>
      </div>
    );
  }

  const seat = me?.seat ?? null;
  const mine = seat !== null && room.state.seat === seat;
  const nameOf = (k: number) => room.names[k] ?? `Player ${k + 1}`;
  let board: React.ReactNode = null, status = "";
  if (room.game === "chess") {
    const st = room.state as unknown as ChessState;
    const legal = C.moves(st.s), res = C.result(st.s, legal);
    const myColor: C.Color = seat === 1 ? "b" : "w";
    status = res.over ? (res.why === "checkmate" ? (watching ? `Checkmate: ${res.winner === "w" ? nameOf(0) : nameOf(1)} wins` : res.winner === myColor ? "Checkmate: you win! 🎉" : "Checkmate: your friend wins") : "A draw") : !room.joined ? "Waiting for your friend to join…" : watching ? `${nameOf(st.seat)} to play` : mine ? (C.inCheck(st.s) ? "You're in check!" : "Your move") : "Their move…";
    const targets = new Set(sel === null ? [] : legal.filter((m) => m.from === sel).map((m) => m.to));
    const order = [...Array(64).keys()]; if (myColor === "b") order.reverse();
    const tap = (i: number) => {
      if (!mine || res.over || !room.joined) return;
      if (sel !== null) {
        const ms = legal.filter((m) => m.from === sel && m.to === i);
        if (ms.length) { const m = ms.find((x) => !x.promo || x.promo === "q")!; setSel(null); void send({ seat: seat === 0 ? 1 : 0, s: C.play(st.s, m), log: [...st.log, C.san(st.s, m)], last: m }); return; }
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
      </>
    );
  } else if (room.game === "gomoku") {
    const st = room.state as unknown as GomokuState;
    const winner = st.line ? st.b[st.line[0]] : null, full = G.full(st.b);
    status = winner !== null ? (watching ? `${nameOf(winner)} gets five in a row` : winner === seat ? "Five in a row: you win! 🎉" : "Your friend got five in a row") : full ? "A draw" : !room.joined ? "Waiting for your friend to join…" : watching ? `${nameOf(st.seat)} to play` : mine ? "Your cup" : "Their move…";
    const win = new Set(st.line ?? []);
    const tap = (i: number) => {
      if (!mine || winner !== null || full || !room.joined || seat === null) return;
      const b = G.play(st.b, i, seat as 0 | 1);
      if (b) void send({ seat: seat === 0 ? 1 : 0, b, last: i, line: G.winLine(b, i) });
    };
    board = (
      <div className="fr-board" style={{ ["--n" as string]: G.N }} role="grid" aria-label="Tablecloth">
        {st.b.map((x, i) => <button key={i} className={`fr-cell ${win.has(i) ? "win" : ""} ${st.last === i ? "last" : ""}`} onClick={() => tap(i)} aria-label={`Square ${i + 1}: ${x === null ? "empty" : `${nameOf(x)}'s cup`}`}>{x !== null && <i className={`fr-cup ${x ? "them" : "you"}`} aria-hidden="true" />}</button>)}
      </div>
    );
  } else if (room.game === "ludo") {
    board = <LiveLudo st={room.state as unknown as LudoState} me={seat} players={room.players} names={room.names} watching={watching} send={(x) => void send(x as unknown as Record<string, unknown>)} />;
  } else if (SERVER.has(room.game)) {
    const st = room.state as never;
    board = room.game === "poker" ? <LivePoker st={st} me={seat} names={room.names} act={(a) => void act(a)} />
      : room.game === "dominoes" ? <LiveDominoes st={st} me={seat} names={room.names} act={(a) => void act(a)} />
      : <LiveLetters st={st} me={seat} names={room.names} act={(a) => void act(a)} />;
  } else {
    const props = { me: (seat ?? 0) as 0 | 1, joined: room.joined && !watching };
    const sendX = (x: unknown) => void send(x as Record<string, unknown>);
    board = room.game === "reversi" ? <LiveReversi st={room.state as unknown as ReversiState} {...props} send={sendX} />
      : room.game === "draughts" ? <LiveDraughts st={room.state as unknown as DraughtsState} {...props} send={sendX} />
      : room.game === "connect4" ? <LiveFour st={room.state as unknown as FourState} {...props} send={sendX} />
      : <LiveBackgammon st={room.state as unknown as BgState} {...props} send={sendX} />;
  }
  const done = finished(room);
  const fresh2 = room.reactions.filter((r) => Date.now() - r.at < 6000);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">{watching ? "watching" : "live"} · room {room.code}</p>
      <h1 className="h2">{titleOf(room.game)} <em>together</em></h1>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="pt-code">{room.code}</span>
        {!watching && room.players < room.seats && <button className="btn btn-pink btn-sm" onClick={() => shareLink()}>📤 Invite</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => shareLink(true)}>👀 Link to watch</button>
        {seat === 0 && !SERVER.has(room.game) && <button className="btn btn-ghost btn-sm" onClick={() => send(fresh(room.game), true)}>New game</button>}
        <Link className="small" href="/play-together" onClick={() => { setRoom(null); setMe(null); setWatching(false); }}>Leave</Link>
      </div>
      <p className="small muted" style={{ margin: "0.4rem 0 0" }}>At the table: {room.names.slice(0, room.players).map((n, k) => `${n}${k === seat ? " (you)" : ""}`).join(", ")}{watching ? " · you're watching" : ""}</p>
      {status && <p className="center small" aria-live="polite" style={{ margin: "0.8rem 0 0.4rem" }}><b>{status}</b></p>}
      <div className="pt-stage">
        {board}
        <div className="pt-pops" aria-live="polite">{fresh2.map((r) => <span key={r.at} className="pt-pop" title={nameOf(r.seat)}>{r.emoji}<small>{nameOf(r.seat)}</small></span>)}</div>
      </div>
      {!watching && (
        <div className="pt-react" role="group" aria-label="Send a reaction">
          {REACTIONS.map((e) => <button key={e} className="btn btn-ghost btn-sm" onClick={() => react(e)} aria-label={`Send ${e}`}>{e}</button>)}
        </div>
      )}
      {done && !watching && seat !== null && (
        <p className="center" style={{ marginTop: "0.8rem" }}>
          <button className="btn btn-pink btn-sm" onClick={rematch} disabled={room.rematch.includes(seat)}>{room.rematch.includes(seat) ? `Waiting for the others (${room.rematch.length}/${room.players})` : "🔁 Rematch"}</button>
        </p>
      )}
      {done && room.rematch.length > 0 && !room.rematch.includes(seat ?? -1) && !watching && <p className="center small">{room.rematch.map(nameOf).join(" and ")} want{room.rematch.length === 1 ? "s" : ""} a rematch.</p>}
      <p className="tiny muted">Moves show up on the other devices within a couple of seconds. Keep this page open while you play.</p>
    </div>
  );
}
