"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { GOOD, LEAD, SONGS, chart, judge, multiplier, points, type Note, type Song } from "@/lib/latteBeat";
import { gameSettings } from "@/lib/gameSettings";
import { addFlag } from "@/lib/trophyFlags";

const PADS = [{ e: "🥛", k: "d" }, { e: "☕", k: "f" }, { e: "⚙️", k: "j" }, { e: "🔔", k: "k" }];
const HZ = [262, 330, 392, 523];
type Run = { notes: Note[]; done: Set<number>; missed: Set<number>; start: number; score: number; combo: number; bestCombo: number; perfect: number; good: number; song: Song };

export default function LatteBeat() {
  const [song, setSong] = useState(SONGS[0]);
  const [run, setRun] = useState<Run | null>(null);
  const [now, setNow] = useState(0);
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState<{ lane: number; grade: string; at: number } | null>(null);
  const live = useRef<Run | null>(null), audio = useRef<AudioContext | null>(null);
  live.current = run;
  const sound = useRef(true);
  useEffect(() => { sound.current = gameSettings().sound; }, []);
  function beep(lane: number, soft = false) {
    if (!sound.current) return;
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current, o = ctx.createOscillator(), v = ctx.createGain();
      o.type = soft ? "sine" : "triangle"; o.frequency.value = soft ? 110 : HZ[lane];
      v.gain.setValueAtTime(soft ? 0.05 : 0.18, ctx.currentTime); v.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      o.connect(v).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.16);
    } catch {}
  }
  function begin(sg = song) {
    try { audio.current ??= new AudioContext(); } catch {}
    const r: Run = { notes: chart(sg, Math.random), done: new Set(), missed: new Set(), start: performance.now() + 600, score: 0, combo: 0, bestCombo: 0, perfect: 0, good: 0, song: sg };
    live.current = r; setRun(r); setOver(false);
  }
  // The clock, misses, and a soft tick on each beat
  useEffect(() => {
    if (!run || over) return;
    let raf = 0, lastBeat = -1;
    const frame = () => {
      const r = live.current!, t = (performance.now() - r.start) / 1000;
      setNow(t);
      const beat = Math.floor(t / (60 / r.song.bpm));
      if (beat !== lastBeat && t > 0) { lastBeat = beat; beep(0, true); }
      let changed = false;
      r.notes.forEach((n, k) => { if (!r.done.has(k) && !r.missed.has(k) && t > n.t + GOOD) { r.missed.add(k); r.combo = 0; changed = true; } });
      if (changed) setRun({ ...r });
      if (t > r.song.secs + 0.5) {
        setOver(true);
        if (r.missed.size === 0 && r.notes.length) addFlag("beat-full-combo");
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [run?.start, over]); // eslint-disable-line react-hooks/exhaustive-deps
  function hit(lane: number) {
    const r = live.current;
    if (!r || over) return;
    const t = (performance.now() - r.start) / 1000;
    const j = judge(r.notes, new Set([...r.done, ...r.missed]), lane, t);
    if (!j) { setFlash({ lane, grade: "miss", at: t }); return; }
    beep(lane);
    r.done.add(j.k); r.combo++; r.bestCombo = Math.max(r.bestCombo, r.combo);
    r.score += Math.round(points(j.grade) * multiplier(r.combo));
    if (j.grade === "perfect") r.perfect++; else r.good++;
    setRun({ ...r }); setFlash({ lane, grade: j.grade, at: t });
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || e.repeat) return;
      const lane = PADS.findIndex((p) => p.k === e.key.toLowerCase());
      if (lane >= 0) { e.preventDefault(); hit(lane); }
      else if (e.key === " " && (e.target as HTMLElement).tagName !== "BUTTON" && (!run || over)) { e.preventDefault(); begin(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  const total = run?.notes.length ?? 0;
  const visible = run ? run.notes.map((n, k) => ({ n, k })).filter(({ n, k }) => !run.done.has(k) && n.t - now < LEAD && n.t - now > -0.3) : [];
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Latte <em>beat</em></h1>
      <p className="small muted">The café&apos;s morning rhythm: milk steamer, cups, grinder and till. Notes slide down the four lanes. Tap a lane (or press D, F, J or K) as its note reaches the line. Right on the beat is a perfect; keep a run going to build your multiplier.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {SONGS.map((sg) => <button key={sg.id} className={`chip ${song.id === sg.id ? "on" : ""}`} aria-pressed={song.id === sg.id} onClick={() => { setSong(sg); setRun(null); setOver(false); }}>{sg.name}</button>)}
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Score <b>{run?.score ?? 0}</b></span><span>Combo <b>{run?.combo ?? 0}</b> ×{multiplier(run?.combo ?? 0)}</span>
      </div>
      <div className="lb2-wrap">
        <div className="lb2-lanes">
          {PADS.map((p, lane) => (
            <div key={lane} className="lb2-lane">
              {visible.filter(({ n }) => n.lane === lane).map(({ n, k }) => <span key={k} className={`lb2-note l${lane}`} style={{ top: `${(1 - (n.t - now) / LEAD) * 85}%` }} aria-hidden="true">{p.e}</span>)}
              {flash && flash.lane === lane && now - flash.at < 0.35 && <span className={`lb2-grade ${flash.grade}`}>{flash.grade === "perfect" ? "Perfect!" : flash.grade === "good" ? "Good" : "Miss"}</span>}
            </div>
          ))}
          <span className="lb2-line" aria-hidden="true" />
        </div>
        {(!run || over) && (
          <div className="bb-over">
            {over && run ? (
              <><b>{run.score} points</b><span className="small">{run.perfect} perfect · {run.good} good · {run.missed.size} missed of {total} · best run {run.bestCombo}</span><button className="btn btn-pink btn-sm" onClick={() => begin()}>Play again</button></>
            ) : <button className="btn btn-pink" onClick={() => begin()}>▶ Start “{song.name}”</button>}
          </div>
        )}
      </div>
      <div className="lb2-pads">
        {PADS.map((p, lane) => <button key={lane} className="lb2-pad" onPointerDown={(e) => { e.preventDefault(); hit(lane); }} aria-label={`Lane ${lane + 1} (${p.k.toUpperCase()})`}>{p.e}<small>{p.k.toUpperCase()}</small></button>)}
      </div>
      <ArcadeBoard game="beat" score={over && run ? run.score : 0} over={over} />
    </div>
  );
}
