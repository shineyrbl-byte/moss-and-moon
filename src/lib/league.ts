// Friends league: a weekly table for you and your friends. A point for every daily puzzle saved this week, and two more
// for the best score among you on that puzzle that day (ties share it). Pure, so the server and tests share it.
export type Row = { voter: string; game: string; date: string; ms: number };
export type Standing = { voter: string; points: number; solved: number; bests: number };
export function league(voters: string[], rows: Row[]): Standing[] {
  const table = new Map(voters.map((v) => [v, { voter: v, points: 0, solved: 0, bests: 0 }]));
  const byPuzzle = new Map<string, Row[]>();
  for (const r of rows) {
    const t = table.get(r.voter);
    if (!t) continue;
    t.points += 1; t.solved += 1;
    const k = `${r.game}|${r.date}`;
    byPuzzle.set(k, [...(byPuzzle.get(k) ?? []), r]);
  }
  // Bests only count when at least two of you played it
  for (const list of byPuzzle.values()) {
    if (new Set(list.map((r) => r.voter)).size < 2) continue;
    const top = Math.min(...list.map((r) => r.ms));
    for (const r of list) if (r.ms === top) { const t = table.get(r.voter)!; t.points += 2; t.bests += 1; }
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.bests - a.bests || voters.indexOf(a.voter) - voters.indexOf(b.voter));
}
