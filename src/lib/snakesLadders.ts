// Spoons & piping bags: snakes and ladders with a café twist. Land at the bottom of a spoon to climb it; land on the nozzle of
// a piping bag and you slide down. First to square 100 wins, and you need the exact roll (too many bounces you back).
// Pure, so the page and tests share it.
export const LAST = 100;
/** Spoons: bottom → top */
export const SPOONS: Record<number, number> = { 3: 22, 8: 30, 28: 84, 36: 44, 51: 67, 58: 77, 71: 92, 80: 99 };
/** Piping bags: nozzle → where you end up */
export const BAGS: Record<number, number> = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 79 };
export type State = { pos: number[]; turn: number; roll: number | null; winner: number | null; note: string };

export const newGame = (players: number): State => ({ pos: Array(players).fill(0), turn: 0, roll: null, winner: null, note: "" });
/** Roll and move. A 6 gives another go. */
export function take(s: State, roll: number): State {
  const p = s.turn;
  let to = s.pos[p] + roll, note = "";
  if (to > LAST) { to = LAST - (to - LAST); note = "bounced back"; }
  if (SPOONS[to]) { note = `climbed a spoon to ${SPOONS[to]}`; to = SPOONS[to]; }
  else if (BAGS[to]) { note = `slid down a piping bag to ${BAGS[to]}`; to = BAGS[to]; }
  const pos = s.pos.map((x, i) => (i === p ? to : x));
  const winner = to === LAST ? p : null;
  return { pos, roll, winner, note, turn: winner !== null || roll === 6 ? p : (p + 1) % s.pos.length };
}
/** Where square n (1..100) sits on the board: the bottom row is 1-10 left to right, the next 11-20 right to left, and so on */
export function cellOf(n: number): [number, number] {
  const k = n - 1, row = Math.floor(k / 10), col = row % 2 ? 9 - (k % 10) : k % 10;
  return [9 - row, col];
}
