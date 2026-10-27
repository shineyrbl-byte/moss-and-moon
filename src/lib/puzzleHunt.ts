// Weekend puzzle hunt: every Saturday and Sunday, five pages around the site hide a little key. Each one has a riddle
// pointing at its page. Find all five that weekend for a trophy. The same keys for everyone, picked from the date. Pure.
import { seededRand, shuffled } from "./gameOrders.ts";

export type Spot = { path: string; riddle: string };
export const SPOTS: Spot[] = [
  { path: "/moon", riddle: "Where the café keeps track of the sky at night, phase by phase." },
  { path: "/sunset", riddle: "Find out when the sun goes down over the sea." },
  { path: "/plants", riddle: "Green friends around the café, and cuttings to swap." },
  { path: "/pups", riddle: "Pup cups and a wall of four-legged regulars." },
  { path: "/songs", riddle: "Ask for a tune, and see what's playing on the TV." },
  { path: "/origins", riddle: "A map of the hills our beans grow in." },
  { path: "/brew", riddle: "A timer for pour-over, AeroPress and moka pot." },
  { path: "/shelf", riddle: "Board games and books to borrow while you sip." },
  { path: "/postcard", riddle: "Send a little card from the café to someone far away." },
  { path: "/konkani", riddle: "Learn a new word in the local language every day." },
  { path: "/journal", riddle: "Notes from the counter." },
  { path: "/recipes", riddle: "Make your café favourites at home." },
  { path: "/wish-tree", riddle: "Hang a wish on the branches." },
  { path: "/fruit-calendar", riddle: "Which Goan fruit is in season this month?" },
  { path: "/doodles", riddle: "A wall of drawings left by guests." },
  { path: "/book-club", riddle: "Read along with the café, a book at a time." },
];
export const HUNT_SIZE = 5;

/** The Saturday a weekend date belongs to, or null on a weekday. Dates are YYYY-MM-DD. */
export function weekendOf(date: string): string | null {
  const d = new Date(`${date}T12:00:00Z`), day = d.getUTCDay();
  if (day !== 6 && day !== 0) return null;
  if (day === 0) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
/** This weekend's five spots, or null on a weekday */
export function huntFor(date: string): { key: string; spots: Spot[] } | null {
  const key = weekendOf(date);
  if (!key) return null;
  return { key, spots: shuffled(SPOTS, seededRand(`hunt:${key}`)).slice(0, HUNT_SIZE) };
}
/** The next Saturday on or after this date */
export function nextHunt(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export const huntKey = (key: string) => `mm-hunt-${key}`;
