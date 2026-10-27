// Hall of fame: who topped each board on past days and weeks.
import "server-only";
import { db } from "./db";
import { toDateStr } from "./cafe";
import { weekOf } from "./polls";
import { pastDays } from "./archive";
import { DAILY_GAMES } from "./gamesStore";
import { isDailyGame, defaultMode } from "./dailyScores";

export const ARCADE = [
  { id: "higherlower", title: "Higher or lower", href: "/higher-or-lower" },
  { id: "merge", title: "Brew merge", href: "/brew-merge" },
  { id: "snake", title: "Bean snake", href: "/bean-snake" },
  { id: "typing", title: "Call the order", href: "/call-the-order" },
  { id: "stacker", title: "Cake stacker", href: "/cake-stacker" },
  { id: "dice", title: "Café dice", href: "/cafe-dice" },
  { id: "echo", title: "Barista's echo", href: "/baristas-echo" },
  { id: "breaker", title: "Bean breaker", href: "/bean-breaker" },
  { id: "pastry", title: "Pastry drop", href: "/pastry-drop" },
  { id: "dash", title: "Delivery dash", href: "/delivery-dash" },
  { id: "puff", title: "Steam puff", href: "/steam-puff" },
  { id: "pigeons", title: "Pigeon patrol", href: "/pigeon-patrol" },
  { id: "muncher", title: "Bean muncher", href: "/bean-muncher" },
  { id: "beat", title: "Latte beat", href: "/latte-beat" },
  { id: "pinball", title: "Pinball parlour", href: "/pinball-parlour" },
  { id: "road", title: "Cross the market road", href: "/market-road" },
  { id: "cupcakes", title: "Pop the cupcakes", href: "/pop-the-cupcakes" },
  { id: "slice", title: "Slice the cake", href: "/slice-the-cake" },
  { id: "swap", title: "Sugar swap", href: "/sugar-swap" },
  { id: "bubble", title: "Bubble pop", href: "/bubble-pop" },
  { id: "defence", title: "Pastry defence", href: "/pastry-defence" },
  { id: "run", title: "Market run", href: "/market-run" },
] as const;

/** The Mondays of the last `n` finished weeks, latest first */
export function pastWeeks(today: string, n: number) {
  const mon = weekOf(today);
  return [...Array(n).keys()].map((k) => new Date(Date.parse(`${mon}T12:00:00Z`) - (k + 1) * 7 * 86400_000).toISOString().slice(0, 10));
}

export type Winner = { when: string; name: string; score: number } | { when: string; name: null; score: null };

export function hallOfFame(now = new Date(), days = 7, weeks = 6) {
  const today = toDateStr(now), dayList = pastDays(today, days), weekList = pastWeeks(today, weeks);
  const fill = (list: string[], rows: { k: string; name: string; score: number }[]): Winner[] => list.map((when) => { const r = rows.find((x) => x.k === when); return r ? { when, name: r.name, score: r.score } : { when, name: null, score: null }; });
  const q = (n: number) => Array(n).fill("?").join(",");
  // SQLite returns the row that holds MIN()/MAX() for the bare columns, so the name matches the score
  const weekly = fill(weekList, db.prepare(`SELECT week AS k, name, MIN(ms) AS score FROM weekly_scores WHERE week IN (${q(weeks)}) GROUP BY week`).all(...weekList) as never);
  const crossword = fill(weekList, db.prepare(`SELECT week AS k, name, MIN(ms) AS score FROM weekly_games WHERE game = 'crossword' AND week IN (${q(weeks)}) GROUP BY week`).all(...weekList) as never);
  const arcade = ARCADE.map((g) => ({ ...g, winners: fill(weekList, db.prepare(`SELECT week AS k, name, MAX(score) AS score FROM arcade_scores WHERE game = ? AND week IN (${q(weeks)}) GROUP BY week`).all(g.id, ...weekList) as never) }));
  const daily = DAILY_GAMES.filter((g) => isDailyGame(g.id)).map((g) => ({
    id: g.id, title: g.title, emoji: g.emoji, href: g.href,
    winners: fill(dayList, db.prepare(`SELECT date AS k, name, MIN(ms) AS score FROM daily_scores WHERE game = ? AND mode = ? AND date IN (${q(days)}) GROUP BY date`).all(g.id, defaultMode(g.id as never), ...dayList) as never),
  }));
  return { today, dayList, weekList, weekly, crossword, arcade, daily };
}
