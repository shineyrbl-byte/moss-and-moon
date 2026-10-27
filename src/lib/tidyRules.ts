// What the daily tidy-up removes, written against any database so tests can try it on a scratch one. Pure SQL.
import type { DatabaseSync } from "node:sqlite";
import { toDateStr } from "./cafe.ts";

const daysAgo = (n: number, now: Date) => toDateStr(new Date(now.getTime() - n * 86_400_000));

/** Played songs after a month (and votes for songs no longer waiting), game nights over a month gone, slow games finished
 * a month ago or untouched for six months, and Goa events three months over. Scores, orders and guests' own things stay. */
export function tidyRows(db: DatabaseSync, now = new Date()) {
  const n = (sql: string, ...args: string[]) => Number(db.prepare(sql).run(...args).changes);
  return {
    songs: n("DELETE FROM song_requests WHERE status = 'played' AND played_at < ?", `${daysAgo(30, now)} 00:00:00`),
    votes: n("DELETE FROM song_votes WHERE song_id NOT IN (SELECT id FROM song_requests WHERE status IN ('queued','playing','pending'))"),
    nights: n("DELETE FROM game_night WHERE date < ?", daysAgo(30, now)),
    slow: n("DELETE FROM slow_games WHERE (json_extract(state, '$.turn') = 0 AND updated < ?) OR updated < ?", `${daysAgo(30, now)} 00:00:00`, `${daysAgo(180, now)} 00:00:00`),
    events: n("DELETE FROM goa_events WHERE MAX(date, end_date) < ?", daysAgo(90, now)),
  };
}
