"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { todayStr } from "@/lib/archive";
import { showDaily } from "@/lib/scoreFormat";
import { addFlag } from "@/lib/trophyFlags";

type P = { name: string; you: boolean } | null;
type M = { a: P; b: P; day: string; scoreA: number | null; scoreB: number | null; winner: P; win: "a" | "b" | null; decided: boolean; why: string };
type T = { code: string; name: string; game: { id: string; title: string; emoji: string; href: string }; start: string; started: boolean; open: boolean; players: P[]; youIn: boolean; host: boolean; days: string[]; rounds: M[][]; champion: P; tooFew: boolean };
const MINE = "mm-tournaments";
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ROUND = (n: number, total: number) => (total - n === 1 ? "Final" : total - n === 2 ? "Semi-finals" : total - n === 3 ? "Quarter-finals" : `Round ${n + 1}`);

export default function Tournament() {
  const { toast } = useStore();
  const [t, setT] = useState<T | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [mine, setMine] = useState<{ code: string; name: string }[]>([]);
  const [games, setGames] = useState<{ id: string; title: string; emoji: string }[]>([]);
  const [form, setForm] = useState({ name: "", game: "sudoku", start: "", playerName: "" });
  const [joinCode, setJoinCode] = useState("");
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("t");
    setCode(c ? c.toUpperCase() : "");
    let name = ""; try { name = localStorage.getItem("mm-game-name") ?? ""; setMine(JSON.parse(localStorage.getItem(MINE) ?? "[]")); } catch {}
    setForm((f) => ({ ...f, playerName: name, start: addDays(todayStr(), 1) }));
    fetch("/api/tournaments?games=1").then((r) => r.json()).then((d: { games: { id: string; title: string; emoji: string }[] }) => setGames(d.games)).catch(() => {});
  }, []);
  useEffect(() => { if (code) fetch(`/api/tournaments?code=${code}&voter=${voterId()}`).then((r) => r.json()).then((d) => (d.error ? toast(d.error) : setT(d))).catch(() => {}); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (t?.champion?.you) addFlag("tournament-won"); }, [t?.champion?.you]);
  function remember(d: T) {
    const next = [{ code: d.code, name: d.name }, ...mine.filter((m) => m.code !== d.code)].slice(0, 12);
    setMine(next); try { localStorage.setItem(MINE, JSON.stringify(next)); } catch {}
  }
  async function post(body: Record<string, unknown>) {
    try { if (form.playerName) localStorage.setItem("mm-game-name", form.playerName); } catch {}
    const r = await fetch("/api/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setT(d); setCode(d.code); remember(d);
    history.replaceState(null, "", `/tournament?t=${d.code}`);
  }
  async function share() {
    if (!t) return;
    const url = `${location.origin}/tournament?t=${t.code}`;
    const text = `Join my ${t.game.title} knockout on Moss & Moon, "${t.name}". It starts ${nice(t.start)}.`;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Invite link copied 📋"); } } catch {}
  }
  const today = todayStr();
  if (code === null) return <div className="page"><p className="muted">Setting up the bracket…</p></div>;
  if (!code || !t) {
    return (
      <div className="page" style={{ maxWidth: "36rem" }}>
        <p className="eyebrow">play with people</p>
        <h1 className="h2">Mini <em>tournaments</em></h1>
        <p className="small muted">A knockout for up to eight friends on one daily puzzle. Everyone joins with your link before it starts. Then each day is a round: whoever saves the better score on that day&apos;s board goes through. Three days for eight players, two for four.</p>
        <form className="card tn-form" onSubmit={(e) => { e.preventDefault(); void post({ create: true, ...form }); }}>
          <label className="field">Tournament name<input className="input" maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Café cup" /></label>
          <label className="field">Puzzle<select className="input" value={form.game} onChange={(e) => setForm({ ...form, game: e.target.value })}>{(games.length ? games : [{ id: "sudoku", title: "Mini sudoku", emoji: "☕" }]).map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}</select></label>
          <label className="field">First round on<input className="input" type="date" min={addDays(today, 1)} max={addDays(today, 14)} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
          <label className="field">Your name<input className="input" maxLength={20} value={form.playerName} onChange={(e) => setForm({ ...form, playerName: e.target.value })} placeholder="Guest" /></label>
          <button className="btn btn-pink">Make the tournament</button>
        </form>
        <div className="row" style={{ alignItems: "end", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <label className="field" style={{ marginBottom: 0, maxWidth: "12rem" }}>Got a code?<input className="input" maxLength={6} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCDEF" style={{ letterSpacing: "0.12em" }} /></label>
          <button className="btn btn-ghost btn-sm" onClick={() => setCode(joinCode)} disabled={joinCode.length < 6}>Open it</button>
        </div>
        {mine.length > 0 && <><h2 className="h3" style={{ marginTop: "1.4rem" }}>Your tournaments</h2><ul className="tn-mine">{mine.map((m) => <li key={m.code}><a href={`/tournament?t=${m.code}`}>{m.name}</a> <span className="tiny muted">{m.code}</span></li>)}</ul></>}
      </div>
    );
  }
  const total = t.days.length, roundToday = t.days.indexOf(today);
  const myMatchToday = roundToday >= 0 ? t.rounds[roundToday]?.find((m) => m.a?.you || m.b?.you) : undefined;
  const show = (v: number | null) => (v === null ? "–" : showDaily(t.game.id, v));
  return (
    <div className="page" style={{ maxWidth: "52rem" }}>
      <p className="eyebrow">mini tournament · {t.code}</p>
      <h1 className="h2">{t.name}</h1>
      <p className="small muted">{t.game.emoji} {t.game.title} knockout · {t.players.length} player{t.players.length === 1 ? "" : "s"} · {t.started ? `started ${nice(t.start)}` : `starts ${nice(t.start)}`}{total ? `, ${total} round${total === 1 ? "" : "s"}` : ""}</p>
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        {t.open && <button className="btn btn-pink btn-sm" onClick={share}>📤 Invite friends</button>}
        <a className="btn btn-ghost btn-sm" href="/tournament">Make another</a>
      </div>
      {t.champion && <p className="card tn-champ" role="status">🏆 <b>{t.champion.name}</b>{t.champion.you ? " (that's you!)" : ""} wins the {t.name}!</p>}
      {myMatchToday && !myMatchToday.decided && <p className="card tn-today">Today&apos;s your {ROUND(roundToday, total).toLowerCase()} match against <b>{(myMatchToday.a?.you ? myMatchToday.b : myMatchToday.a)?.name}</b>. <Link href={t.game.href}>Play today&apos;s {t.game.title} →</Link> Save your score on the board for it to count.</p>}
      {t.open && !t.youIn && (
        <form className="row tn-join" onSubmit={(e) => { e.preventDefault(); void post({ join: t.code, name: form.playerName }); }}>
          <label className="field" style={{ marginBottom: 0 }}>Your name<input className="input" maxLength={20} value={form.playerName} onChange={(e) => setForm({ ...form, playerName: e.target.value })} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm">Join the tournament</button>
        </form>
      )}
      {!t.started && <><h2 className="h3" style={{ marginTop: "1.2rem" }}>Who&apos;s in</h2><ol className="tn-players">{t.players.map((p, k) => <li key={k}>{p?.name}{p?.you ? " (you)" : ""}</li>)}</ol>{t.players.length < 2 && <p className="small muted">It needs at least two players by {nice(t.start)}.</p>}</>}
      {t.tooFew && <p className="small muted">Nobody else joined in time, so this one didn&apos;t go ahead.</p>}
      {t.rounds.length > 0 && (
        <div className="tn-bracket" style={{ ["--rounds" as string]: total }}>
          {t.rounds.map((rd, n) => (
            <section key={n} className="tn-round">
              <h2 className="h3">{ROUND(n, total)}</h2>
              <p className="tiny muted">{nice(t.days[n])}{t.days[n] === today ? " · today" : ""}</p>
              {rd.map((m, k) => (
                <div key={k} className={`tn-match ${m.decided ? "done" : ""}`}>
                  {([[m.a, m.scoreA], [m.b, m.scoreB]] as const).map(([p, sc], j) => (
                    <div key={j} className={`tn-side ${m.win === (j === 0 ? "a" : "b") && m.decided ? "win" : ""} ${m.win === (j === 0 ? "a" : "b") && !m.decided ? "lead" : ""} ${p?.you ? "you" : ""}`}>
                      <span>{p ? p.name : m.decided || n === 0 ? "bye" : "…"}</span><b>{p ? show(sc) : ""}</b>
                    </div>
                  ))}
                  {m.why && <p className="tiny muted" style={{ margin: "0.2rem 0 0" }}>{m.decided ? "" : "⏳ "}{m.why}</p>}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      <p className="tiny muted" style={{ marginTop: "1rem" }}>Only scores saved on the day&apos;s board count, at the usual level. A match is settled at midnight, so you can still beat your own time until then.</p>
    </div>
  );
}
