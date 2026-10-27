// How a daily puzzle's stored score reads out loud. Most are a time; a few pack a count and a time into one number.
const clock = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const split = (v: number) => ({ n: Math.floor(v / 1_000_000), ms: v % 1_000_000 });

export function showDaily(game: string, v: number): string {
  if (game === "boggle") return `${1_000_000 - v} points`;
  if (game === "flood") { const { n, ms } = split(v); return `${n} moves, ${clock(ms)}`; }
  if (game === "corners") { const { n, ms } = split(v); return `${n} words, ${clock(ms)}`; }
  if (game === "four") { const { n, ms } = split(v); return `${n} tries, ${clock(ms)}`; }
  if (game === "bill") { const { n, ms } = split(v); return `${n ? `${n} off` : "spot on"}, ${clock(ms)}`; }
  if (game === "wheel") { const { n, ms } = split(v); return `${40 - n} words, ${clock(ms)}`; }
  if (game === "push") { const { n, ms } = split(v); return `${n} moves, ${clock(ms)}`; }
  if (game === "price") { const { n, ms } = split(v); return `${n} go${n === 1 ? "" : "es"}, ${clock(ms)}`; }
  return clock(v);
}
export { clock as showClock };
