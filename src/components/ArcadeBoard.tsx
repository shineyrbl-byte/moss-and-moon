"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };

/** The weekly board for an arcade game, with saving a finished score */
export default function ArcadeBoard({ game, score, over, title = "This week's best" }: { game: string; score: number; over: boolean; title?: string }) {
  const { toast } = useStore();
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  useEffect(() => {
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/arcade?game=${game}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [game]);
  // A new game means a new score to save
  useEffect(() => { if (!over) setSaved(null); }, [over]);
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, score, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(score);
  }
  return (
    <>
      {over && score > 0 && saved !== score && (
        <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem", marginTop: "0.6rem" }}>
          <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
        </div>
      )}
      {saved === score && over && <p className="small center">Saved ✓</p>}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">{title}</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No scores yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </>
  );
}
