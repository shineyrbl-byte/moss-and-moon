// Slow games on the server: make a game, join by link, and take turns whenever you like
import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { db, cleanText } from "./db";
import { apply, isKind, newState, options, winLine, KINDS, type State } from "./slowGames";

type Row = { id: string; kind: string; state: string; seat1: string; seat2: string | null; name1: string; name2: string; updated: string };
const token = () => randomBytes(16).toString("hex");
const cleanName = (n: unknown) => cleanText(n, 20).replace(/[<>]/g, "") || "Guest";
const same = (a: string, b: unknown) => typeof b === "string" && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const get = (id: unknown) => (typeof id === "string" && /^[a-f0-9]{10}$/.test(id) ? (db.prepare("SELECT * FROM slow_games WHERE id = ?").get(id) as Row | undefined) ?? null : null);
const seatOf = (r: Row, t: unknown): 1 | 2 | null => (same(r.seat1, t) ? 1 : r.seat2 && same(r.seat2, t) ? 2 : null);

/** What a player (or a visitor with the link) sees */
function view(r: Row, t?: unknown) {
  const s = JSON.parse(r.state) as State, seat = seatOf(r, t);
  return { id: r.id, kind: s.kind, title: KINDS[s.kind].title, board: s.board, turn: s.turn, winner: s.winner, moves: s.moves, last: s.last, line: winLine(s), names: [r.name1, r.name2], open: !r.seat2, seat, options: seat ? options(s, seat) : [], updated: r.updated };
}
export function createSlowGame(b: Record<string, unknown>) {
  if (!isKind(b.kind)) return { error: "Pick a game." };
  const id = randomBytes(5).toString("hex"), t = token();
  db.prepare("INSERT INTO slow_games (id, kind, state, seat1, name1) VALUES (?, ?, ?, ?, ?)").run(id, b.kind, JSON.stringify(newState(b.kind)), t, cleanName(b.name));
  return { ...view(get(id)!, t), token: t };
}
export function joinSlowGame(b: Record<string, unknown>) {
  const r = get(b.id);
  if (!r) return { error: "We couldn't find that game." };
  if (r.seat2) return { error: "Someone's already taken the other seat." };
  const t = token();
  db.prepare("UPDATE slow_games SET seat2 = ?, name2 = ?, updated = datetime('now') WHERE id = ? AND seat2 IS NULL").run(t, cleanName(b.name), r.id);
  return { ...view(get(r.id)!, t), token: t };
}
export function moveSlowGame(b: Record<string, unknown>) {
  const r = get(b.id);
  if (!r) return { error: "We couldn't find that game." };
  const seat = seatOf(r, b.token);
  if (!seat) return { error: "That's not your seat in this game." };
  if (!r.seat2) return { error: "Wait for your friend to join first." };
  const n = apply(JSON.parse(r.state) as State, seat, Math.round(Number(b.move)));
  if ("error" in n) return n;
  db.prepare("UPDATE slow_games SET state = ?, updated = datetime('now') WHERE id = ?").run(JSON.stringify(n), r.id);
  return view(get(r.id)!, b.token);
}
export function slowGame(id: unknown, t?: unknown) {
  const r = get(id);
  return r ? view(r, t) : { error: "We couldn't find that game." };
}
