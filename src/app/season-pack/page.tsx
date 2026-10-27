"use client";
import "../colour-pixels/page.css";
import "../cafe-hangman/page.css";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import PixelPuzzle from "@/components/PixelPuzzle";
import { PACKS, packToday, seasonKey, type PackId } from "@/lib/seasonPacks";
import { clock } from "@/lib/memory";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null };
const ABC = "abcdefghijklmnopqrstuvwxyz".split("");

export default function SeasonPack() {
  const { toast } = useStore();
  const [live, setLive] = useState<PackId | null | undefined>(undefined);
  const [pick, setPick] = useState<PackId>("diwali");
  const [tab, setTab] = useState(0);
  const [times, setTimes] = useState<(number | null)[]>([null, null, null]);
  const [board, setBoard] = useState<Board | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  // Hangman with the pack's words
  const [word, setWord] = useState(""), [guessed, setGuessed] = useState<string[]>([]), [found, setFound] = useState(0);
  useEffect(() => {
    const p = packToday(); setLive(p); if (p) setPick(p);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    if (p) fetch(`/api/weekly-games?game=season&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  const pack = PACKS[pick];
  // Kept per season and year, so next year's pack starts fresh
  const key = `mm-season-${seasonKey(new Date(), pick)}`;
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(key) ?? "null"); setTimes(v?.times ?? [null, null, null]); setSaved(!!v?.saved); setFound(v?.found ?? 0); } catch { setTimes([null, null, null]); }
    setTab(0); newWord();
  }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = useMemo(() => Object.keys(pack.words), [pack]);
  function newWord() { setWord(words[Math.floor(Math.random() * words.length)] ?? ""); setGuessed([]); }
  function store(t: (number | null)[], s = saved, f = found) { try { localStorage.setItem(key, JSON.stringify({ times: t, saved: s, found: f })); } catch {} }
  function solvedPicture(k: number, ms: number) {
    const t = times.map((x, i) => (i === k ? ms : x)); setTimes(t); store(t);
    toast(`${pack.pictures[k].name}! 🎨`);
    if (t.every((x) => x !== null)) { addFlag(`season-${pick}`); toast("The whole pack's done! 🎉"); }
  }
  const allDone = times.every((x) => x !== null), total = times.reduce<number>((n, x) => n + (x ?? 0), 0);
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/weekly-games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "season", ms: Math.max(30_000, total), name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true); store(times, true);
  }
  const wrong = guessed.filter((l) => !word.includes(l)).length, won = !!word && [...word].every((c) => guessed.includes(c)), lost = wrong >= 7;
  function guess(l: string) {
    if (won || lost || guessed.includes(l)) return;
    const g = [...guessed, l]; setGuessed(g);
    if ([...word].every((c) => g.includes(c))) { const f = found + 1; setFound(f); store(times, saved, f); }
  }
  if (live === undefined) return <div className="page"><p className="muted">Unpacking…</p></div>;
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">season pack</p>
      <h1 className="h2">{pack.emoji} {pack.title.split(" ")[0]} <em>pack</em></h1>
      <p className="small muted">{pack.blurb} {live === pick ? "It's on now: finish the three pictures to go on this season's board." : live ? "" : "No season's on right now, but you can still play any pack for fun."}</p>
      <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
        {(Object.keys(PACKS) as PackId[]).map((id) => <button key={id} className={`chip ${pick === id ? "on" : ""}`} onClick={() => setPick(id)}>{PACKS[id].emoji} {PACKS[id].title}{live === id ? " · on now" : ""}</button>)}
      </div>
      <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap", marginTop: "0.6rem" }} role="tablist">
        {pack.pictures.map((p, k) => <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{times[k] !== null ? "✓ " : ""}Picture {k + 1}</button>)}
        <button role="tab" aria-selected={tab === 3} className={`chip ${tab === 3 ? "on" : ""}`} onClick={() => setTab(3)}>🔤 Words{found ? ` · ${found}` : ""}</button>
      </div>
      {tab < 3 ? (
        <>
          <PixelPuzzle key={`${pick}-${tab}`} rows={pack.pictures[tab].rows} solved={times[tab] !== null} onSolved={(ms) => solvedPicture(tab, ms)} />
          {times[tab] !== null && <p className="center small"><b>{pack.pictures[tab].name}</b> · {clock(times[tab]!)}</p>}
        </>
      ) : (
        <>
          <p className="center small muted">Clue: {pack.words[word]}</p>
          <p className="hm-word">{[...word].map((c, k) => <span key={k} className={lost && !guessed.includes(c) ? "missed" : ""}>{guessed.includes(c) || lost ? c : ""}</span>)}</p>
          <p className="center small">Wrong {wrong}/7</p>
          {won || lost ? <p className="center"><b>{won ? "Got it! 🎉" : `It was ${word.toUpperCase()}.`}</b> <button className="btn btn-pink btn-sm" onClick={newWord}>Next word</button></p>
            : <div className="hm-keys">{ABC.map((l) => <button key={l} className={`hm-key ${guessed.includes(l) ? (word.includes(l) ? "good" : "bad") : ""}`} disabled={guessed.includes(l)} onClick={() => guess(l)}>{l.toUpperCase()}</button>)}</div>}
        </>
      )}
      {allDone && live === pick && (
        <section className="card" style={{ padding: "0.9rem 1rem", marginTop: "1rem" }}>
          <b>All three pictures: {clock(total)} 🎉</b>
          {!saved ? (
            <div className="row" style={{ alignItems: "end", gap: "0.5rem", flexWrap: "wrap" }}>
              <label className="field" style={{ marginBottom: 0, maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
        </section>
      )}
      {live === pick && board && <section style={{ marginTop: "1rem" }}><h2 className="h3">This season&apos;s best</h2>{board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet. Be the first.</p>}</section>}
    </div>
  );
}
