// Latte beat: notes slide down four lanes (milk, cups, grinder, till) in time to the beat. Tap a lane as its note reaches the
// line. Bang on the beat scores most, and a run of hits builds a multiplier. Pure, so the page and tests share it.
export const LANES = 4;
export const LEAD = 1.6; // seconds a note takes to fall to the line
export const PERFECT = 0.07, GOOD = 0.14; // seconds either side
export const BEAT_MAX = 9_999_999;
export type Note = { t: number; lane: number };
export type Song = { id: string; name: string; bpm: number; secs: number; level?: number };
export const SONGS: Song[] = [
  { id: "drip", name: "Slow drip (easy)", bpm: 84, secs: 50 },
  { id: "rush", name: "Morning rush", bpm: 104, secs: 60 },
  { id: "espresso", name: "Double espresso (hard)", bpm: 126, secs: 60 },
  // Levels 2 and 3: busier charts, more off-beats and more notes in pairs
  { id: "coldbrew", name: "Cold brew groove (level 2)", bpm: 112, secs: 70, level: 2 },
  { id: "cardamom", name: "Cardamom shuffle (level 3)", bpm: 138, secs: 70, level: 3 },
];
/** The notes for a song: mostly on the beat, with half-beats and pairs as it builds */
export function chart(song: Song, rand: () => number): Note[] {
  const beat = 60 / song.bpm, out: Note[] = [];
  let lane = Math.floor(rand() * LANES);
  for (let t = 2; t < song.secs - 1; t += beat / 2) {
    const onBeat = Math.round((t - 2) / beat * 2) % 2 === 0, build = (t / song.secs);
    const busy = 1 + ((song.level ?? 1) - 1) * 0.45;
    if (!onBeat && rand() > (0.12 + build * 0.35 * (song.bpm / 100)) * busy) continue;
    if (onBeat && rand() < 0.15 - build * 0.1) continue;
    lane = (lane + 1 + Math.floor(rand() * 3)) % LANES;
    out.push({ t: +t.toFixed(3), lane });
    if (onBeat && build > 0.5 && rand() < 0.12 * (song.bpm / 100) * busy) out.push({ t: +t.toFixed(3), lane: (lane + 2) % LANES });
  }
  return out;
}
export const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 10) * 0.5);
/** Judge a tap at time `now` on `lane`: the nearest waiting note in that lane, if close enough */
export function judge(notes: Note[], done: Set<number>, lane: number, now: number): { k: number; grade: "perfect" | "good" } | null {
  let best = -1, gap = Infinity;
  notes.forEach((n, k) => { if (n.lane !== lane || done.has(k)) return; const g = Math.abs(n.t - now); if (g < gap) { gap = g; best = k; } });
  if (best < 0 || gap > GOOD) return null;
  return { k: best, grade: gap <= PERFECT ? "perfect" : "good" };
}
export const points = (grade: "perfect" | "good") => (grade === "perfect" ? 300 : 100);
