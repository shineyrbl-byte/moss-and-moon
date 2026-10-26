// Live games between two devices. The room keeps the game's state and a version number; each move must come from the
// player whose turn it is, against the latest version. The game rules themselves are checked on each device.
import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { db } from "./db";

export const ROOM_GAMES = ["chess", "gomoku"] as const;
export type RoomGame = (typeof ROOM_GAMES)[number];
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DAY = 86_400_000;
const MAX_STATE = 60_000;
export const cleanRoom = (c: unknown) => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) : "");
type Row = { code: string; game: RoomGame; state: string; version: number; host: string; guest: string | null; updated_at: number };
const get = (code: string) => db.prepare("SELECT * FROM game_rooms WHERE code = ?").get(code) as Row | undefined;
const seatOf = (r: Row, token: unknown) => (typeof token === "string" && token ? (token === r.host ? 0 : token === r.guest ? 1 : null) : null);
const view = (r: Row) => ({ code: r.code, game: r.game, state: JSON.parse(r.state), version: r.version, joined: !!r.guest });

export function createRoom(game: unknown, state: unknown) {
  if (!ROOM_GAMES.includes(game as RoomGame)) return { error: "That game can't be played live yet." };
  const json = JSON.stringify(state ?? {});
  if (json.length > MAX_STATE) return { error: "That game is too big to send." };
  db.prepare("DELETE FROM game_rooms WHERE updated_at < ?").run(Date.now() - DAY);
  const host = randomBytes(16).toString("hex");
  for (let tries = 0; tries < 30; tries++) {
    const code = [...Array(5)].map(() => ALPHA[randomInt(ALPHA.length)]).join("");
    if (db.prepare("INSERT OR IGNORE INTO game_rooms (code, game, state, host, updated_at) VALUES (?, ?, ?, ?, ?)").run(code, game as string, json, host, Date.now()).changes) return { ...view(get(code)!), token: host, seat: 0 };
  }
  return { error: "Couldn't make a room just now. Try again." };
}
export function joinRoom(codeIn: unknown, token?: unknown) {
  const r = get(cleanRoom(codeIn));
  if (!r) return { error: "We couldn't find that room. It may have finished." };
  const seat = seatOf(r, token);
  if (seat !== null) return { ...view(r), token, seat };
  if (r.guest) return { error: "Two people are already playing in that room." };
  const guest = randomBytes(16).toString("hex");
  db.prepare("UPDATE game_rooms SET guest = ?, version = version + 1, updated_at = ? WHERE code = ? AND guest IS NULL").run(guest, Date.now(), r.code);
  return { ...view(get(r.code)!), token: guest, seat: 1 };
}
export function readRoom(codeIn: unknown) {
  const r = get(cleanRoom(codeIn));
  return r ? view(r) : { error: "That room has closed." };
}
/** { code, token, version, state }: the new state must say whose turn it is next (state.seat) */
export function moveRoom(b: Record<string, unknown>) {
  const r = get(cleanRoom(b.code));
  if (!r) return { error: "That room has closed." };
  const seat = seatOf(r, b.token);
  if (seat === null) return { error: "You're not playing in this room." };
  const cur = JSON.parse(r.state) as { seat?: number };
  const reset = b.reset === true && seat === 0;
  if (!reset && cur.seat !== seat) return { error: "It's not your turn.", ...view(r) };
  if (Number(b.version) !== r.version) return { error: "The board changed. Here's the latest.", ...view(r) };
  const json = JSON.stringify(b.state ?? {});
  if (json.length > MAX_STATE) return { error: "That move is too big to send." };
  db.prepare("UPDATE game_rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?").run(json, Date.now(), r.code, r.version);
  return view(get(r.code)!);
}
