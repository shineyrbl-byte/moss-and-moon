// Replays of a solve: the boards along the way, played back quickly. Pure.
export type Frame<T> = [ms: number, state: T];
export const MAX_FRAMES = 300;
/** Keep a long solve's replay small: past the limit, drop every other frame (never the first or last) */
export function thinFrames<T>(f: Frame<T>[], max = MAX_FRAMES): Frame<T>[] {
  if (f.length <= max) return f;
  return f.filter((_, i) => i === 0 || i === f.length - 1 || i % 2 === 0);
}
/** When to show each frame: long pauses are cut to `gap`, and the whole thing squeezed into `total` ms at most */
export function planReplay(times: number[], { gap = 1500, total = 12_000, lead = 500, tail = 1200 } = {}) {
  const at = [0];
  for (let i = 1; i < times.length; i++) at.push(at[i - 1] + Math.min(gap, Math.max(0, times[i] - times[i - 1])));
  const len = at[at.length - 1], k = len > total ? total / len : 1;
  return { at: at.map((x) => lead + Math.round(x * k)), end: lead + Math.round(len * k) + tail };
}
