"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { DEFAULTS, buzz, gameSettings, saveGameSettings, type GameSettings } from "@/lib/gameSettings";

const ROWS: { key: keyof GameSettings; title: string; how: string }[] = [
  { key: "sound", title: "🔊 Sound", how: "Barista's echo and other games that make sounds start with sound on. Each game still has its own mute button." },
  { key: "vibrate", title: "📳 Vibration", how: "A short buzz on phones when a game tells you something: a word found, a win, a mistake. Off unless you turn it on." },
  { key: "patterns", title: "🎨 Colour-blind patterns", how: "Puzzles that rely on colour also use patterns and symbols: Flood the cup shows symbols, Table for one's sections get stripes and dots, and Pour paths marks each path with its cup." },
];

export default function GameSettingsPage() {
  const { toast } = useStore();
  const [s, setS] = useState<GameSettings>(DEFAULTS);
  useEffect(() => { setS(gameSettings()); }, []);
  function flip(k: keyof GameSettings) {
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
      <p className="small"><Link href="/games">← Back to the games corner</Link></p>
    </div>
  );
}
