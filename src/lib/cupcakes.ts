// Pop the cupcakes: cupcakes pop up out of the tins for a moment; tap them before they sink. Golden ones are worth
// more; leave the burnt ones alone. Thirty seconds, getting quicker as it goes. Pure, so the page and tests share it.
export const HOLES = 9;
export const GAME_MS = 30_000;
export type Kind = "cake" | "gold" | "burnt";
export const POINTS: Record<Kind, number> = { cake: 10, gold: 30, burnt: -20 };
export type Pop = { at: number; until: number; hole: number; kind: Kind };

/** The whole game's pop-ups, worked out from the start */
export function schedule(rand: () => number): Pop[] {
  const out: Pop[] = [];
  let t = 500;
  while (t < GAME_MS - 400) {
    const p = t / GAME_MS; // 0 → 1 as the game goes on
    const stay = 1300 - 650 * p + rand() * 300;
    const busy = new Set(out.filter((o) => o.until > t).map((o) => o.hole));
    const free = [...Array(HOLES).keys()].filter((h) => !busy.has(h));
    if (free.length) {
      const r = rand();
      const kind: Kind = r < 0.08 ? "gold" : r < 0.08 + 0.1 + 0.1 * p ? "burnt" : "cake";
      out.push({ at: Math.round(t), until: Math.round(Math.min(GAME_MS, t + (kind === "gold" ? stay * 0.7 : stay))), hole: free[Math.floor(rand() * free.length)], kind });
    }
    t += 650 - 380 * p + rand() * 250;
  }
  return out;
}
/** What's showing at time t (not yet tapped) */
export const showing = (pops: Pop[], hit: Set<number>, t: number) => pops.flatMap((p, i) => (p.at <= t && t < p.until && !hit.has(i) ? [i] : []));
/** Tap a tin: the index of the pop-up you got, if any */
export function tap(pops: Pop[], hit: Set<number>, hole: number, t: number): number | null {
  const i = showing(pops, hit, t).find((k) => pops[k].hole === hole);
  return i === undefined ? null : i;
}
export const scoreOf = (pops: Pop[], hit: Set<number>) => Math.max(0, [...hit].reduce((n, i) => n + POINTS[pops[i].kind], 0));
/** The most anyone could score (every good cupcake, no burnt ones), for the weekly board's sanity check */
export const CUPCAKE_MAX = 3000;
