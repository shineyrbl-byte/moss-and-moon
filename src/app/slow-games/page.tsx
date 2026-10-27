"use client";
import "./page.css";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { KINDS, type Kind } from "@/lib/slowGames";
import { addFlag } from "@/lib/trophyFlags";

type V = { id: string; kind: Kind; title: string; board: number[]; turn: 0 | 1 | 2; winner: 0 | 1 | 2 | null; moves: number; last: number | null; line: number[]; names: [string, string]; open: boolean; seat: 1 | 2 | null; options: number[]; updated: string; token?: string; alerts?: boolean };
type Mine = { id: string; token: string };
const KEY = "mm-slow-games";
const loadMine = (): Mine[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const saveMine = (m: Mine[]) => { try { localStorage.setItem(KEY, JSON.stringify(m.slice(-30))); } catch {} };
const toKey = (base64: string) => { const raw = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
const colour = (kind: Kind, p: 1 | 2) => (kind === "connect4" ? (p === 1 ? "#c94c4c" : "#e8b86a") : p === 1 ? "#2b1d1a" : "#fbf6ef");

export default function SlowGames() {
  const { toast } = useStore();
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [g, setG] = useState<V | null>(null);
  const [list, setList] = useState<V[]>([]);
  const [name, setName] = useState("");
  const tokenFor = (gid: string) => loadMine().find((m) => m.id === gid)?.token ?? "";
  const load = useCallback(async (gid: string) => {
    const r = await fetch(`/api/slow-games?id=${gid}&token=${tokenFor(gid)}`);
    if (r.ok) setG(await r.json()); else { setG(null); toast("We couldn't find that game."); }
  }, [toast]);
  useEffect(() => {
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    const q = new URLSearchParams(location.search).get("g");
    setId(q && /^[a-f0-9]{10}$/.test(q) ? q : null);
  }, []);
  useEffect(() => {
    if (id === undefined) return;
    if (id) { load(id); const t = setInterval(() => { if (!document.hidden) load(id); }, 15000); return () => clearInterval(t); }
    Promise.all(loadMine().map((m) => fetch(`/api/slow-games?id=${m.id}&token=${m.token}`).then((r) => (r.ok ? r.json() : null)).catch(() => null))).then((vs) => setList((vs.filter(Boolean) as V[]).reverse()));
  }, [id, load]);
  useEffect(() => { if (g && g.seat && g.turn === 0) addFlag("slow-done"); }, [g]);
  function open(gid: string | null) { history.replaceState(null, "", gid ? `?g=${gid}` : location.pathname); setG(null); setId(gid); }
  async function post(body: Record<string, unknown>) {
    try { if (name) localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/slow-games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { toast(d.error); return null; }
    if (d.token) saveMine([...loadMine().filter((m) => m.id !== d.id), { id: d.id, token: d.token }]);
    return d as V;
  }
  async function create(kind: Kind) { const d = await post({ kind, name }); if (d) { open(d.id); setG(d); share(d.id, d.title); } }
  async function share(gid: string, title: string) {
    const url = `${location.origin}/slow-games?g=${gid}`, text = `Play a slow game of ${title} with me at Moss & Moon. A move whenever you like:`;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied. Send it to your friend 📋"); } } catch {}
  }
  // "Tell me when it's my turn": a push notification on this device
  async function alerts(on: boolean) {
    try {
      let subscription: PushSubscriptionJSON | null = null;
      if (on) {
        if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) return toast("This browser can't show alerts. On an iPhone, add the site to your home screen first.");
        if ((await Notification.requestPermission()) !== "granted") return toast("Alerts are blocked for this site in your browser settings.");
        const reg = await navigator.serviceWorker.ready, { publicKey } = await fetch("/api/push").then((r) => r.json());
        subscription = ((await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }))).toJSON();
      }
      const d = await post({ id: g!.id, token: tokenFor(g!.id), subscription });
      if (d) { setG(d); toast(on ? "🔔 We'll tell you when it's your move" : "Alerts off for this game"); }
    } catch { toast("Couldn't turn on alerts on this browser."); }
  }
  async function move(m: number) { const d = await post({ id: g!.id, token: tokenFor(g!.id), move: m }); if (d) setG(d); }

  if (id === undefined) return <div className="page"><p className="muted">Setting up the table…</p></div>;
  if (!id) return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">play by link</p>
      <h1 className="h2">Slow <em>games</em></h1>
      <p className="small muted">Start a game, send the link to a friend, and take turns whenever you like: a move over breakfast, one tomorrow. The board waits for you. Your games are kept in this browser.</p>
      <label className="field" style={{ maxWidth: "14rem" }}>Your name<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>{(Object.keys(KINDS) as Kind[]).map((k) => <button key={k} className="btn btn-pink btn-sm" onClick={() => create(k)}>{KINDS[k].emoji} New {KINDS[k].title}</button>)}</div>
      <h2 className="h3" style={{ marginTop: "1.2rem" }}>Your games</h2>
      {list.length ? <ul className="sg-list">{list.map((v) => {
        const mine = v.seat && v.turn === v.seat && !v.open, other = v.names[v.seat === 1 ? 1 : 0] || "your friend";
        return <li key={v.id} className={mine ? "turn" : ""}><span>{KINDS[v.kind].emoji} {v.title} with <b>{other}</b><br /><span className="tiny muted">{v.turn === 0 ? (v.winner === 0 ? "A draw" : v.winner === v.seat ? "You won 🎉" : "They won") : v.open ? "Waiting for them to join" : mine ? "Your move!" : "Their move"} · {v.moves} moves</span></span><button className="btn btn-ghost btn-sm" onClick={() => open(v.id)}>Open</button></li>;
      })}</ul> : <p className="small muted">No games yet. Start one above.</p>}
      <p className="small"><Link href="/play-together">🎮 Want to play right now instead? Play a friend live →</Link></p>
    </div>
  );
  if (!g) return <div className="page"><p className="muted">Fetching the board…</p><button className="link-btn" onClick={() => open(null)}>← All my games</button></div>;
  const me = g.seat, you = (p: 1 | 2) => (me === p ? "You" : g.names[p - 1] || (p === 2 ? "Your friend" : "Them"));
  const canJoin = !me && g.open;
  const status = g.turn === 0 ? (g.winner === 0 ? "It's a draw!" : `${you(g.winner as 1 | 2)} won${me === g.winner ? "! 🎉" : "."}`) : g.open ? (me ? "Waiting for your friend to join. Send them the link." : "There's a free seat!") : `${me === g.turn ? "Your move" : `${you(g.turn)}'s move`}`;
  const cols = g.kind === "connect4" ? 7 : 8;
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <button className="link-btn small" onClick={() => open(null)}>← All my games</button>
      <h1 className="h2">{KINDS[g.kind].emoji} {g.title}</h1>
      <p className="small"><span className="sg-dot" style={{ background: colour(g.kind, 1) }} /> {you(1)} vs <span className="sg-dot" style={{ background: colour(g.kind, 2) }} /> {g.open ? "…" : you(2)} · {g.moves} moves{g.kind === "reversi" ? ` · ${g.board.filter((x) => x === 1).length}–${g.board.filter((x) => x === 2).length}` : ""}</p>
      <p role="status"><b>{status}</b></p>
      {canJoin && <div className="row" style={{ alignItems: "end", gap: "0.5rem", flexWrap: "wrap" }}><label className="field" style={{ marginBottom: 0, maxWidth: "12rem" }}>Your name<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label><button className="btn btn-pink btn-sm" onClick={async () => { const d = await post({ id: g.id, join: true, name }); if (d) setG(d); }}>Take the seat</button></div>}
      {g.kind === "connect4" && me && g.options.length > 0 && <div className="sg-cols" role="group" aria-label="Drop in a column">{[...Array(7).keys()].map((c) => <button key={c} className="sg-col" disabled={!g.options.includes(c)} onClick={() => move(c)} aria-label={`Column ${c + 1}`}>↓</button>)}</div>}
      <div className={`sg-board ${g.kind}`} role="group" data-grid="" aria-label={`${g.title} board`}>
        {g.board.map((v, i) => {
          const can = g.kind === "reversi" && g.options.includes(i);
          return <button key={i} className={`sg-cell ${v ? `p${v}` : ""} ${can ? "can" : ""} ${g.last === i ? "last" : ""} ${g.line.includes(i) ? "win" : ""}`} disabled={!can} onClick={() => can && move(i)}
            aria-label={`Row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}: ${v ? you(v as 1 | 2) : can ? "you can play here" : "empty"}`} />;
        })}
      </div>
      <p className="center"><button className="btn btn-ghost btn-sm" onClick={() => share(g.id, g.title)}>📤 Send the link</button>{me && g.turn !== 0 && <> <button className="btn btn-ghost btn-sm" aria-pressed={!!g.alerts} onClick={() => alerts(!g.alerts)}>{g.alerts ? "🔕 Stop alerts" : "🔔 Tell me when it's my turn"}</button></>}</p>
      <p className="tiny muted center">{g.kind === "connect4" ? "Four in a row, any way, wins." : "Trap their pieces between yours to turn them over. Most pieces at the end wins."} The page checks for new moves every 15 seconds while it&apos;s open.</p>
    </div>
  );
}
