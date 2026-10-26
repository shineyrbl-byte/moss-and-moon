"use client";
import { useEffect, useRef, useState } from "react";
import { planReplay, thinFrames, type Frame } from "@/lib/replay";

export type Replay = { can: boolean; on: boolean; start: () => void; stop: () => void };

/**
 * Replays of a daily puzzle: notes the board each time it changes while you solve, then plays it back quickly.
 * `key` is where the puzzle saves (its own day's key), `first` the untouched board. While `on`, pages shouldn't save.
 */
export function useReplay<T>({ key, date, state, setState, start, doneMs, first }: {
  key: string; date: string; state: T | null; setState: (s: T) => void; start: number | null; doneMs: number | null; first: T | null;
}) {
  const trail = useRef<Frame<T>[]>([]);
  const [loaded, setLoaded] = useState("");
  const [can, setCan] = useState(false);
  const [on, setOn] = useState(false);
  const playing = useRef<{ timers: ReturnType<typeof setTimeout>[]; final: T } | null>(null);
  const slot = `${key}:replay`, id = `${slot}|${date}`;
  // Load this day's trail (again whenever the day or level changes)
  useEffect(() => {
    if (!date) return;
    trail.current = [];
    try { const r = JSON.parse(localStorage.getItem(slot) ?? "null"); if (r?.date === date && Array.isArray(r.frames)) trail.current = r.frames; } catch {}
    setCan(trail.current.length > 0); setLoaded(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loaded !== id || !start || playing.current || state === null) return;
    const last = trail.current[trail.current.length - 1];
    if (doneMs !== null && last && last[0] >= doneMs) return;
    if (last && JSON.stringify(last[1]) === JSON.stringify(state)) return;
    if (!last && first !== null && JSON.stringify(first) === JSON.stringify(state)) return;
    trail.current = thinFrames([...trail.current, [doneMs ?? Math.max(0, Date.now() - start), state]]);
    try { localStorage.setItem(slot, JSON.stringify({ date, frames: trail.current })); } catch {}
    if (doneMs !== null) setCan(true);
  }, [loaded, id, state, start, doneMs]); // eslint-disable-line react-hooks/exhaustive-deps
  function stop() {
    const p = playing.current;
    if (!p) return;
    p.timers.forEach(clearTimeout);
    playing.current = null;
    setOn(false); setState(p.final);
  }
  function play() {
    if (playing.current || !trail.current.length || state === null) return;
    const frames: Frame<T>[] = first === null ? trail.current : [[0, first], ...trail.current];
    const plan = planReplay(frames.map((f) => f[0]));
    const p = { timers: [] as ReturnType<typeof setTimeout>[], final: state };
    playing.current = p; setOn(true);
    frames.forEach((f, i) => p.timers.push(setTimeout(() => setState(f[1]), plan.at[i])));
    p.timers.push(setTimeout(stop, plan.end));
  }
  useEffect(() => () => playing.current?.timers.forEach(clearTimeout), []);
  const replay: Replay = { can: can && doneMs !== null, on, start: play, stop };
  return { replay, on };
}
