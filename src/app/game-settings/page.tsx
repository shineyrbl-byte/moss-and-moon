"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import GameReminder from "@/components/GameReminder";
import { BOARD_THEMES, DEFAULTS, buzz, gameSettings, saveGameSettings, type BoardTheme, type GameSettings } from "@/lib/gameSettings";

const ROWS: { key: Exclude<keyof GameSettings, "board">; title: string; how: string }[] = [
  { key: "sound", title: "🔊 Sound", how: "Barista's echo and other games that make sounds start with sound on. Each game still has its own mute button." },
  { key: "vibrate", title: "📳 Vibration", how: "A short buzz on phones when a game tells you something: a word found, a win, a mistake. Off unless you turn it on." },
  { key: "patterns", title: "🎨 Colour-blind patterns", how: "Puzzles that rely on colour also use patterns and symbols: Flood the cup shows symbols, Table for one's sections get stripes and dots, and Pour paths marks each path with its cup." },
  { key: "reader", title: "🔈 Screen-reader help", how: "For puzzle grids: each grid is one stop when you Tab through the page, and the arrow keys move you square by square (Home and End go to the ends of a row). Bigger focus outlines, and animations stay still. Arrow keys work in grids for everyone; this makes them easier with a screen reader." },
  { key: "zen", title: "🧘 Zen mode", how: "Puzzles without the pressure: no clocks, no ghost, no boards or saving. Just you and the puzzle. Your streaks only count saved scores, so they pause while this is on." },
];

export default function GameSettingsPage() {
  const { toast } = useStore();
  const [s, setS] = useState<GameSettings>(DEFAULTS);
  useEffect(() => { setS(gameSettings()); }, []);
  function board(t: BoardTheme) {
    const next = { ...s, board: t };
    setS(next); saveGameSettings(next);
    toast(`${BOARD_THEMES.find((x) => x.id === t)!.name} boards`);
  }
  function flip(k: Exclude<keyof GameSettings, "board">) {
    const next = { ...s, [k]: !s[k] };
    setS(next); saveGameSettings(next);
    if (k === "vibrate" && next.vibrate) buzz([30, 60, 30]);
    toast(`${ROWS.find((r) => r.key === k)!.title.slice(3)} ${next[k] ? "on" : "off"}`);
  }
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">games corner</p>
      <h1 className="h2">Game <em>settings</em></h1>
      <p className="small muted">These apply to every game on this device. Bigger text and calmer motion are in the <b>Aa</b> menu at the top of every page.</p>
      <ul className="gs-list">
        {ROWS.map((r) => (
          <li key={r.key}>
            <span><b>{r.title}</b><small className="muted">{r.how}</small></span>
            <button className={`switch ${s[r.key] ? "" : "off"}`} aria-pressed={s[r.key]} aria-label={r.title.slice(3)} onClick={() => flip(r.key)} />
          </li>
        ))}
      </ul>
      <h2 className="h3" style={{ marginTop: "1.2rem" }}>🎨 Board look</h2>
      <p className="small muted">One look for every puzzle grid: sudoku, the word games, nonograms and the rest.</p>
      <div className="gs-boards" role="radiogroup" aria-label="Board look">
        {BOARD_THEMES.map((t) => (
          <button key={t.id} role="radio" aria-checked={s.board === t.id} className={`gs-board ${s.board === t.id ? "on" : ""}`} onClick={() => board(t.id)}>
            <span className="gs-swatch" aria-hidden="true">{t.swatch.map((c, k) => <i key={k} style={{ background: c }} />)}</span>
            <b>{t.name}</b><small className="muted">{t.how}</small>
          </button>
        ))}
      </div>
      <div className="gs-preview" role="group" data-grid="" aria-label="Preview of the board look">
        {["5", "", "3", "", "7", "1", "", "", "4"].map((v, k) => <span key={k} className={`gs-pcell ${k === 4 ? "at" : ""}`}>{v}</span>)}
      </div>
      <GameReminder />
      <p className="small"><Link href="/games">← Back to the games corner</Link></p>
    </div>
  );
}
