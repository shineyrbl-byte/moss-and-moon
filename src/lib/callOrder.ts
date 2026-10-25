// Call the order: type the orders before they reach the end of the rail. Pure, so the page and tests share it.
export const TYPING_MAX = 999, LIVES = 3;
const DRINKS = ["latte", "flat white", "cappuccino", "mocha", "cortado", "chai", "americano", "hot chocolate", "matcha latte", "cold brew", "espresso", "iced latte", "filter coffee", "masala chai"];
const MILKS = ["oat", "almond", "soy", "whole milk", "skimmed", "coconut"];
const SIZES = ["small", "regular", "large"];
const EXTRAS = ["extra hot", "no sugar", "with cinnamon", "to go", "extra shot", "less ice", "with honey", "half sweet", "for here"];

/** Longer orders as the score climbs */
export function orderText(score: number, rand: () => number) {
  const pick = (a: string[]) => a[Math.floor(rand() * a.length)];
  const drink = pick(DRINKS);
  if (score < 4) return drink;
  if (score < 10) return `${pick(MILKS)} ${drink}`;
  if (score < 18) return `${pick(SIZES)} ${pick(MILKS)} ${drink}`;
  return `${pick(SIZES)} ${pick(MILKS)} ${drink}, ${pick(EXTRAS)}`;
}
/** Case, commas and extra spaces don't matter */
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trimStart();

export type Ticket = { id: number; text: string; born: number; travel: number };
/** The oldest ticket that what you've typed so far fits */
export function matchTicket(tickets: Ticket[], typed: string) {
  const t = norm(typed);
  if (!t) return null;
  return [...tickets].sort((a, b) => a.born - b.born).find((k) => norm(k.text).startsWith(t)) ?? null;
}
export const isDone = (ticket: Ticket, typed: string) => norm(typed).trimEnd() === norm(ticket.text);
/** How long a ticket takes to cross the rail, and how often new ones come */
export const travelMs = (score: number) => Math.max(6500, 15000 - score * 250);
export const spawnMs = (score: number) => Math.max(1600, 4200 - score * 90);
