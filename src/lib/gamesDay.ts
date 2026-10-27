// Café Games Day: the second Saturday of November. A banner and countdown on the games page, and trophies
// for finishing 5 and 10 daily puzzles on the day. Pure.

/** The date of Games Day in a year (YYYY-MM-DD) */
export function gamesDay(year: number) {
  const d = new Date(Date.UTC(year, 10, 1, 12));
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}
/** The next Games Day on or after this date */
export function nextGamesDay(date: string) {
  const y = Number(date.slice(0, 4)), g = gamesDay(y);
  return g >= date ? g : gamesDay(y + 1);
}
/** Whole days from one date to another */
export const daysUntil = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
/** The most daily puzzles finished on any Games Day */
export function bestGamesDay(played: Record<string, string[]>) {
  const counts = new Map<string, number>();
  for (const days of Object.values(played)) for (const d of new Set(days)) if (d === gamesDay(Number(d.slice(0, 4)))) counts.set(d, (counts.get(d) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}
