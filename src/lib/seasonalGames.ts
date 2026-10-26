// Seasonal game events: while the café dresses up for a festival, there's a trophy for playing through it. Pure.
import { seasonFor, type SeasonId } from "./seasons.ts";

export type SeasonEvent = { id: string; season: SeasonId | "newyear"; emoji: string; name: string; how: string; need: number; unit: "plays" | "days" };
export const EVENTS: SeasonEvent[] = [
  { id: "diwaliGames", season: "diwali", emoji: "🪔", name: "Festival of lights", how: "Finish 5 daily puzzles during Diwali week", need: 5, unit: "plays" },
  { id: "monsoonGames", season: "monsoon", emoji: "☔", name: "Monsoon regular", how: "Play on 20 different days in the monsoon (mid-June to mid-September)", need: 20, unit: "days" },
  { id: "christmasGames", season: "christmas", emoji: "🎄", name: "Christmas cracker", how: "Finish 10 daily puzzles over Christmas and New Year", need: 10, unit: "plays" },
  { id: "valentinesGames", season: "valentines", emoji: "💗", name: "Puzzle sweetheart", how: "Play on 3 days in Valentine's week", need: 3, unit: "days" },
  { id: "newYearGames", season: "newyear", emoji: "🎆", name: "Fresh start", how: "Play a daily puzzle on New Year's Day", need: 1, unit: "days" },
];
const inEvent = (e: SeasonEvent, date: string) => (e.season === "newyear" ? date.slice(5) === "01-01" : seasonFor(new Date(`${date}T12:00:00`)) === e.season);

/** How far along an event you are. Seasons come round every year, so this counts the latest one you've played in. */
export function progress(e: SeasonEvent, played: Record<string, string[]>) {
  const all = Object.values(played).flatMap((days) => [...new Set(days)]).filter((d) => inEvent(e, d));
  // Group by the year the season started in (Christmas runs over New Year)
  const yearOf = (d: string) => (e.season === "christmas" && d.slice(5) <= "01-01" ? +d.slice(0, 4) - 1 : +d.slice(0, 4));
  const byYear = new Map<number, string[]>();
  for (const d of all) byYear.set(yearOf(d), [...(byYear.get(yearOf(d)) ?? []), d]);
  const count = (ds: string[]) => (e.unit === "days" ? new Set(ds).size : ds.length);
  return Math.max(0, ...[...byYear.values()].map(count));
}
/** The event running today, if any */
export const eventToday = (date: string) => EVENTS.find((e) => inEvent(e, date)) ?? null;
