// Live games between devices. The room keeps the game's state and a version number; each move must come from the
// player whose turn it is, against the latest version. Most games' rules are checked on each device; games with hidden
// hands (poker, dominoes, café letters) are played by the server, which only shows each player their own cards.
// Anyone with the code can watch; players can send an emoji, and ask for a rematch.
import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { db, cleanText } from "./db";
import { apply, freshState, isServerGame, seated, view as seatView, type Action, type RoomState } from "./roomGames";

export const ROOM_GAMES = ["chess", "gomoku", "reversi", "draughts", "connect4", "backgammon", "ludo", "poker", "dominoes", "letters"] as const;
export type RoomGame = (typeof ROOM_GAMES)[number];
export const SEATS: Record<RoomGame, number> = { chess: 2, gomoku: 2, reversi: 2, draughts: 2, connect4: 2, backgammon: 2, ludo: 4, poker: 4, dominoes: 2, letters: 2 };
export const REACTIONS = ["👏", "😂", "😮", "😅", "🔥", "☕"];
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DAY = 86_400_000;
const MAX_STATE = 60_000;
export const cleanRoom = (c: unknown) => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) : "");
type Row = { code: string; game: RoomGame; state: string; version: number; host: string; guest: string | null; updated_at: number; extra: string; names: string; reactions: string; rematch: string; fresh: string | null };
const get = (code: string) => db.prepare("SELECT * FROM game_rooms WHERE code = ?").get(code) as Row | undefined;
const tokens = (r: Row) => [r.host, r.guest, ...(JSON.parse(r.extra) as string[])].filter((x): x is string => !!x);
const seatOf = (r: Row, token: unknown) => (typeof token === "string" && token ? (() => { const k = tokens(r).indexOf(token); return k < 0 ? null : k; })() : null);
/** What a device sees: the whole state for open games, or just its own hand for hidden-hand games */
function view(r: Row, seat: number | null) {
  const raw = JSON.parse(r.state);
  const state = isServerGame(r.game) ? seatView(raw as RoomState, seat) : raw;
  const taken = tokens(r).length;
  return { code: r.code, game: r.game, state, version: r.version, joined: taken >= 2, players: taken, seats: SEATS[r.game], names: JSON.parse(r.names) as string[], reactions: (JSON.parse(r.reactions) as { seat: number; emoji: string; at: number }[]).filter((x) => Date.now() - x.at < 8000), rematch: JSON.parse(r.rematch) as number[], server: isServerGame(r.game) };
}
const name = (n: unknown, seat: number) => cleanText(n, 16).replace(/[<>]/g, "") || `Player ${seat + 1}`;

export function createRoom(game: unknown, state: unknown, playerName?: unknown) {
  if (!ROOM_GAMES.includes(game as RoomGame)) return { error: "That game can't be played live yet." };
  const server = isServerGame(game);
  const first = server ? freshState(game, randomInt(2 ** 30)) : state ?? {};
  const json = JSON.stringify(first);
  if (json.length > MAX_STATE) return { error: "That game is too big to send." };
  db.prepare("DELETE FROM game_rooms WHERE updated_at < ?").run(Date.now() - DAY);
  const host = randomBytes(16).toString("hex");
  for (let tries = 0; tries < 30; tries++) {
    const code = [...Array(5)].map(() => ALPHA[randomInt(ALPHA.length)]).join("");
    if (db.prepare("INSERT OR IGNORE INTO game_rooms (code, game, state, host, updated_at, names, fresh) VALUES (?, ?, ?, ?, ?, ?, ?)").run(code, game as string, json, host, Date.now(), JSON.stringify([name(playerName, 0)]), server ? null : json).changes)
      return { ...view(get(code)!, 0), token: host, seat: 0 };
  }
  return { error: "Couldn't make a room just now. Try again." };
}
export function joinRoom(codeIn: unknown, token?: unknown, playerName?: unknown) {
  const r = get(cleanRoom(codeIn));
  if (!r) return { error: "We couldn't find that room. It may have finished." };
  const seat = seatOf(r, token);
  if (seat !== null) return { ...view(r, seat), token, seat };
  const all = tokens(r);
  if (all.length >= SEATS[r.game]) return { error: "That room's full, but you can watch.", full: true };
  if (r.game === "poker" && (JSON.parse(r.state) as { started?: boolean }).started) return { error: "The game's already started, but you can watch.", full: true };
  const fresh = randomBytes(16).toString("hex"), names = JSON.parse(r.names) as string[];
  names[all.length] = name(playerName, all.length);
  let state = r.state;
  if (isServerGame(r.game)) state = JSON.stringify(seated(JSON.parse(r.state) as RoomState, all.length + 1));
  if (!r.guest) db.prepare("UPDATE game_rooms SET guest = ?, names = ?, state = ?, version = version + 1, updated_at = ? WHERE code = ? AND guest IS NULL").run(fresh, JSON.stringify(names), state, Date.now(), r.code);
  else db.prepare("UPDATE game_rooms SET extra = ?, names = ?, state = ?, version = version + 1, updated_at = ? WHERE code = ?").run(JSON.stringify([...JSON.parse(r.extra), fresh]), JSON.stringify(names), state, Date.now(), r.code);
  const after = get(r.code)!;
  return { ...view(after, all.length), token: fresh, seat: all.length };
}
export function readRoom(codeIn: unknown, token?: unknown) {
  const r = get(cleanRoom(codeIn));
  return r ? view(r, seatOf(r, token)) : { error: "That room has closed." };
}
/** { code, token, version, state } for open games, or { code, token, action } for hidden-hand ones */
export function moveRoom(b: Record<string, unknown>) {
  const r = get(cleanRoom(b.code));
  if (!r) return { error: "That room has closed." };
  const seat = seatOf(r, b.token);
  if (seat === null) return { error: "You're not playing in this room." };
  if (isServerGame(r.game)) {
    const res = apply(JSON.parse(r.state) as RoomState, seat, b.action as Action);
    if ("error" in res) return { error: res.error, ...view(r, seat) };
    db.prepare("UPDATE game_rooms SET state = ?, version = version + 1, updated_at = ?, rematch = '[]' WHERE code = ?").run(JSON.stringify(res.s), Date.now(), r.code);
    return view(get(r.code)!, seat);
  }
  const cur = JSON.parse(r.state) as { seat?: number };
  const reset = b.reset === true && seat === 0;
  if (!reset && cur.seat !== seat) return { error: "It's not your turn.", ...view(r, seat) };
  if (Number(b.version) !== r.version) return { error: "The board changed. Here's the latest.", ...view(r, seat) };
  const json = JSON.stringify(b.state ?? {});
  if (json.length > MAX_STATE) return { error: "That move is too big to send." };
  db.prepare("UPDATE game_rooms SET state = ?, version = version + 1, updated_at = ?, rematch = '[]' WHERE code = ? AND version = ?").run(json, Date.now(), r.code, r.version);
  return view(get(r.code)!, seat);
}
/** A quick emoji for the other players (and anyone watching) */
export function reactRoom(codeIn: unknown, token: unknown, emoji: unknown) {
  const r = get(cleanRoom(codeIn));
  if (!r) return { error: "That room has closed." };
  const seat = seatOf(r, token);
  if (seat === null || typeof emoji !== "string" || !REACTIONS.includes(emoji)) return { error: "Can't send that." };
  const list = [...(JSON.parse(r.reactions) as { seat: number; emoji: string; at: number }[]).filter((x) => Date.now() - x.at < 8000), { seat, emoji, at: Date.now() }].slice(-12);
  db.prepare("UPDATE game_rooms SET reactions = ?, version = version + 1 WHERE code = ?").run(JSON.stringify(list), r.code);
  return view(get(r.code)!, seat);
}
/** Ask for a rematch. When everyone at the table has, the board starts again. */
export function rematchRoom(codeIn: unknown, token: unknown) {
  const r = get(cleanRoom(codeIn));
  if (!r) return { error: "That room has closed." };
  const seat = seatOf(r, token);
  if (seat === null) return { error: "You're not playing in this room." };
  const votes = [...new Set([...(JSON.parse(r.rematch) as number[]), seat])];
  if (votes.length < tokens(r).length) {
    db.prepare("UPDATE game_rooms SET rematch = ?, version = version + 1 WHERE code = ?").run(JSON.stringify(votes), r.code);
    return view(get(r.code)!, seat);
  }
  let state: string;
  if (isServerGame(r.game)) state = JSON.stringify(seated(freshState(r.game, randomInt(2 ** 30)), tokens(r).length));
  else state = r.fresh ?? JSON.stringify({ seat: 0 });
  db.prepare("UPDATE game_rooms SET state = ?, rematch = '[]', version = version + 1, updated_at = ? WHERE code = ?").run(state, Date.now(), r.code);
  return view(get(r.code)!, seat);
}
