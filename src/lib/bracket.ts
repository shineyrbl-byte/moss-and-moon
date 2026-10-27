// Mini tournaments: a knockout between friends on a daily puzzle. Round 1 is the start day's puzzle, round 2 the next
// day's, and so on. In each pair, the better saved score that day goes through; if only one of you played, you go
// through; if neither did, the one who joined first does. Pure, so the server and tests share it.
export type Player = { voter: string; name: string };
export type Match = { a: Player | null; b: Player | null; day: string; scoreA: number | null; scoreB: number | null; winner: Player | null; decided: boolean; why: string };

const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const roundsFor = (players: number) => Math.max(1, Math.ceil(Math.log2(Math.max(2, players))));
export const roundDay = (start: string, round: number) => addDays(start, round);

/** Seed into a bracket of 2, 4 or 8 slots, so byes go to the earliest joiners */
export function seed(players: Player[]): (Player | null)[] {
  const size = 2 ** roundsFor(players.length);
  // Standard seeding order (1 v 8, 4 v 5, 3 v 6, 2 v 7 for eight) keeps the top seeds apart
  let order = [1];
  while (order.length < size) order = order.flatMap((s) => [s, order.length * 2 + 1 - s]);
  return order.map((s) => players[s - 1] ?? null);
}

/** The bracket as it stands. `score(day, voter)` is that player's saved score on that day (lower is better), or null.
 * A match is only settled once its day is over (you can still beat your own time until midnight); until then the
 * leader so far is shown. Later rounds fill in as earlier ones finish. */
export function bracket(players: Player[], start: string, today: string, score: (day: string, voter: string) => number | null): Match[][] {
  const rounds: Match[][] = [];
  let slots: (Player | null)[] = seed(players), known = true;
  for (let r = 0; r < roundsFor(players.length); r++) {
    const day = roundDay(start, r), over = day < today;
    const matches: Match[] = [];
    for (let k = 0; k < slots.length; k += 2) {
      const a = slots[k], b = slots[k + 1];
      if (!known) { matches.push({ a, b, day, scoreA: null, scoreB: null, winner: null, decided: false, why: "" }); continue; }
      const scoreA = a ? score(day, a.voter) : null, scoreB = b ? score(day, b.voter) : null;
      let winner: Player | null = null, decided = false, why = "";
      if (a && !b) { winner = a; decided = true; why = "a bye"; }
      else if (b && !a) { winner = b; decided = true; why = "a bye"; }
      else if (a && b) {
        const lead = scoreA !== null && scoreB !== null ? (scoreA <= scoreB ? a : b) : scoreA !== null ? a : scoreB !== null ? b : null;
        if (over) { decided = true; winner = lead ?? a; why = scoreA !== null && scoreB !== null ? "better score" : lead ? "the only one who played" : "nobody played, so the first to join goes through"; }
        else { winner = lead; why = lead ? "leading so far" : ""; }
      }
      matches.push({ a, b, day, scoreA, scoreB, winner, decided, why });
    }
    rounds.push(matches);
    // The next round's pairs are only known once every match in this one is settled
    if (known && matches.every((m) => m.decided)) slots = matches.map((m) => m.winner);
    else { slots = matches.map((m) => (m.decided ? m.winner : null)); known = false; }
  }
  return rounds;
}
export const champion = (rounds: Match[][]) => { const last = rounds[rounds.length - 1]; return last.length === 1 && last[0].decided ? last[0].winner : null; };
