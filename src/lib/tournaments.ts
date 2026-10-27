// Mini tournaments: make a knockout for up to eight friends on a daily puzzle. Everyone joins with the link before it
// starts; then each day is a round, decided by the times people save on that day's board.
import "server-only";
import { randomInt } from "node:crypto";
import { db, cleanText } from "./db";
import { toDateStr } from "./cafe";
import { DAILY_GAMES } from "./gamesStore";
import { defaultMode, isDailyGame } from "./dailyScores";
import { bracket, champion, roundDay, roundsFor, type Player } from "./bracket";

export const MAX_PLAYERS = 8;
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);
const cleanName = (n: unknown) => cleanText(n, 20).replace(/[<>]/g, "") || "Guest";
const cleanCode = (c: unknown) => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) : "");
type Row = { code: string; name: string; game: string; start: string; players: string; host: string };
export const TOURNAMENT_GAMES = DAILY_GAMES.filter((g) => isDailyGame(g.id)).map((g) => ({ id: g.id, title: g.title, emoji: g.emoji, href: g.href }));

const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function createTournament(b: Record<string, unknown>, now = new Date()) {
  const voter = cleanVoter(b.voter);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  if (!isDailyGame(b.game)) return { error: "Pick a daily puzzle to play." };
  const today = toDateStr(now), start = typeof b.start === "string" && /^\d{4}-\d\d-\d\d$/.test(b.start) ? b.start : addDays(today, 1);
  if (start <= today || start > addDays(today, 14)) return { error: "Start it on a day in the next two weeks (not today: people need time to join)." };
  const players: Player[] = [{ voter, name: cleanName(b.playerName) }];
  for (let tries = 0; tries < 30; tries++) {
    const code = [...Array(6)].map(() => ALPHA[randomInt(ALPHA.length)]).join("");
    const ok = db.prepare("INSERT OR IGNORE INTO tournaments (code, name, game, start, players, host) VALUES (?, ?, ?, ?, ?, ?)").run(code, cleanText(b.name, 40) || "Café cup", b.game as string, start, JSON.stringify(players), voter).changes;
    if (ok) return tournamentView(code, voter, now);
  }
  return { error: "Couldn't make a tournament just now. Try again." };
}
export function joinTournament(codeIn: unknown, voterIn: unknown, nameIn: unknown, now = new Date()) {
  const voter = cleanVoter(voterIn), code = cleanCode(codeIn);
  if (!voter) return { error: "Something went wrong. Refresh and try again." };
  const r = db.prepare("SELECT * FROM tournaments WHERE code = ?").get(code) as Row | undefined;
  if (!r) return { error: "We couldn't find that tournament." };
  if (toDateStr(now) >= r.start) return { error: "It's already started, so it's too late to join." };
  const players = JSON.parse(r.players) as Player[];
  if (players.some((p) => p.voter === voter)) return tournamentView(code, voter, now);
  if (players.length >= MAX_PLAYERS) return { error: `It's full: ${MAX_PLAYERS} players at most.` };
  players.push({ voter, name: cleanName(nameIn) });
  db.prepare("UPDATE tournaments SET players = ? WHERE code = ?").run(JSON.stringify(players), code);
  return tournamentView(code, voter, now);
}
/** Everything the page shows. Players' private IDs never leave the server: they become seat numbers. */
export function tournamentView(codeIn: unknown, voterIn?: unknown, now = new Date()) {
  const code = cleanCode(codeIn), voter = cleanVoter(voterIn);
  const r = db.prepare("SELECT * FROM tournaments WHERE code = ?").get(code) as Row | undefined;
  if (!r || !isDailyGame(r.game)) return { error: "We couldn't find that tournament." };
  const players = JSON.parse(r.players) as Player[], today = toDateStr(now), mode = defaultMode(r.game);
  const q = db.prepare("SELECT MIN(ms) AS ms FROM daily_scores WHERE game = ? AND date = ? AND voter = ? AND mode = ?");
  const started = today >= r.start;
  const rounds = players.length >= 2 && started ? bracket(players, r.start, today, (day, v) => (q.get(r.game, day, v, mode) as { ms: number | null }).ms) : [];
  const champ = rounds.length ? champion(rounds) : null;
  const pub = (p: Player | null) => (p ? { name: p.name, you: p.voter === voter } : null);
  const game = TOURNAMENT_GAMES.find((g) => g.id === r.game)!;
  return {
    code: r.code, name: r.name, game, start: r.start, started, open: !started, players: players.map(pub),
    youIn: !!voter && players.some((p) => p.voter === voter), host: voter === r.host,
    days: players.length >= 2 ? [...Array(roundsFor(players.length)).keys()].map((k) => roundDay(r.start, k)) : [],
    rounds: rounds.map((rd) => rd.map((m) => ({ a: pub(m.a), b: pub(m.b), day: m.day, scoreA: m.scoreA, scoreB: m.scoreB, winner: pub(m.winner), win: m.winner ? (m.winner === m.a ? "a" : "b") : null, decided: m.decided, why: m.why }))),
    champion: pub(champ), tooFew: started && players.length < 2,
  };
}
