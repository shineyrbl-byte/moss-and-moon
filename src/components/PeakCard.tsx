import type { Card } from "@/lib/peaks";
const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], SUITS = ["☕", "🍓", "🍫", "🌸"];
export const cardName = (c: Card) => `${RANK[c.r]} of ${["coffee", "strawberry", "chocolate", "blossom"][c.s]}`;
/** A small playing card for the two peak solitaires */
export default function PeakCard({ c, down }: { c?: Card | null; down?: boolean }) {
  if (!c || down) return <span className="pk-card down" aria-hidden="true" />;
  return <span className={`pk-card ${c.s % 2 ? "red" : ""}`} aria-hidden="true"><b>{RANK[c.r]}</b>{SUITS[c.s]}</span>;
}
