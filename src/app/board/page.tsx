"use client";
import { useEffect, useRef, useState } from "react";
import { HAPPY_HOUR, isHappyHour } from "@/lib/pricing";
import { useLive } from "@/components/useLive";
import TodayLine from "@/components/TodayLine";

type Entry = { code: string; name: string; table: number | null };
type Board = { preparing: Entry[]; ready: Entry[] };

// Two soft notes when an order turns ready
function ding() {
  try {
    const ctx = new AudioContext();
    [660, 990].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch {}
}

// "Now serving" screen for the café TV. Open /board on the TV and go full screen.
export default function BoardPage() {
  const [board, setBoard] = useState<Board>({ preparing: [], ready: [] });
  const [kick, setKick] = useState(0);
  useLive("/api/live?topic=board", () => setKick((k) => k + 1));
  const [now, setNow] = useState<Date | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const [sound, setSound] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seenReady = useRef<Set<string> | null>(null);
  const soundRef = useRef(false);
  soundRef.current = sound;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [b, q] = await Promise.all([fetch("/api/board").then((r) => r.json()), fetch("/api/queue").then((r) => r.json())]);
        if (!alive) return;
        // Highlight orders that just became ready
        const ids = new Set<string>(b.ready.map((e: Entry) => e.code));
        if (seenReady.current) {
          const newOnes = [...ids].filter((c) => !seenReady.current!.has(c));
          if (newOnes.length) {
            setFresh(new Set(newOnes));
            if (soundRef.current) ding();
            setTimeout(() => setFresh(new Set()), 8000);
          }
        }
        seenReady.current = ids;
        setBoard(b);
        setWait(q.minutes);
      } catch {}
    };
    load();
    const t = setInterval(load, 15000);
    const c = setInterval(() => setNow(new Date()), 1000);
    setNow(new Date());
    return () => { alive = false; clearInterval(t); clearInterval(c); };
  }, [kick]);

  const happy = now ? isHappyHour(now) : false;
  const label = (e: Entry) => (e.table ? `table ${e.table}` : e.name);

  return (
    <div className="board">
      <header className="board-head">
        <span className="logo">Moss <span>&amp;</span> Moon</span>
        <span className="board-clock">{now?.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
        <div className="board-tools">
          <button onClick={() => { setSound((s) => !s); if (!sound) ding(); }}>{sound ? "🔔 Sound on" : "🔕 Tap for sound"}</button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>⛶ Full screen</button>
        </div>
      </header>

      <h1 className="sr-only">Now serving</h1>
      <TodayLine big />
      <div className="board-cols">
        <section>
          <h2>☕ Brewing</h2>
          <ul>
            {board.preparing.map((e) => (
              <li key={e.code} className="board-item"><strong>{e.code}</strong><span>{label(e)}</span></li>
            ))}
            {!board.preparing.length && <li className="board-empty">All caught up ✿</li>}
          </ul>
        </section>
        <section className="ready">
          <h2>🌸 Ready</h2>
          <ul>
            {board.ready.map((e) => (
              <li key={e.code} className={`board-item ${fresh.has(e.code) ? "fresh" : ""}`}><strong>{e.code}</strong><span>{e.table ? `on its way to table ${e.table}` : e.name}</span></li>
            ))}
            {!board.ready.length && <li className="board-empty">Nothing waiting at the counter</li>}
          </ul>
        </section>
      </div>

      <footer className="board-foot">
        <span>{happy ? `✨ It's golden hour! ${HAPPY_HOUR.label}` : `☀︎ ${HAPPY_HOUR.label}`}</span>
        <span>⏱ Current wait ~{wait ?? "…"} min</span>
        <span>📱 Scan the QR on your table to order from your seat</span>
      </footer>
    </div>
  );
}
