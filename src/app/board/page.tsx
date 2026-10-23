"use client";
import { useEffect, useRef, useState } from "react";
import { HAPPY_HOUR, isHappyHour } from "@/lib/pricing";
import { useLive } from "@/components/useLive";
import TodayLine from "@/components/TodayLine";

type Entry = { code: string; name: string; table: number | null };
type Board = { preparing: Entry[]; ready: Entry[] };
type Song = { id: number; title: string; artist: string; name: string };

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
  const [songs, setSongs] = useState<{ playing: Song | null; next: Song[] }>({ playing: null, next: [] });
  const [sound, setSound] = useState(false);
  const [doodles, setDoodles] = useState<{ id: number; url: string; name: string; caption: string }[]>([]);
  const [doodleAt, setDoodleAt] = useState(0);
  const [story, setStory] = useState<{ text: string; name: string } | null>(null);
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
        fetch("/api/songs").then((r) => r.json()).then((d) => alive && setSongs(d)).catch(() => {});
        fetch("/api/stories?week=1").then((r) => r.json()).then((d) => alive && setStory(d.week)).catch(() => {});
        fetch("/api/photos?kind=doodle").then((r) => r.json()).then((d) => { if (alive && Array.isArray(d.photos)) { setDoodles(d.photos.slice(0, 12)); setDoodleAt((i) => i + 1); } }).catch(() => {});
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

      {(songs.playing || songs.next.length > 0) && (
        <div className="board-songs" aria-live="polite">
          {songs.playing && <span>🎵 <b>{songs.playing.title}</b>{songs.playing.artist ? ` · ${songs.playing.artist}` : ""} <span className="muted">for {songs.playing.name}</span></span>}
          {songs.next.length > 0 && <span className="muted">Up next: {songs.next.slice(0, 3).map((x) => x.title).join(" · ")}</span>}
          <span className="muted">Request one: table QR → 🔔 → 🎵</span>
        </div>
      )}
      {story && <p className="board-story">✍️ <q>{story.text}</q> <span className="muted">· six-word story of the week{story.name ? ` by ${story.name}` : ""}</span></p>}
      {doodles.length > 0 && (() => {
        const d = doodles[doodleAt % doodles.length];
        return (
          <aside className="board-doodle" aria-label="A guest doodle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.url} alt="" />
            <span>🎨 {d.caption || "A doodle"} <span className="muted">by {d.name}</span><br /><span className="muted">Draw one: mossandmoon → Doodle wall</span></span>
          </aside>
        );
      })()}
      <footer className="board-foot">
        <span>{happy ? `✨ It's golden hour! ${HAPPY_HOUR.label}` : `☀︎ ${HAPPY_HOUR.label}`}</span>
        <span>⏱ Current wait ~{wait ?? "…"} min</span>
        <span>📱 Scan the QR on your table to order from your seat</span>
      </footer>
    </div>
  );
}
