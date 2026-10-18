// Loyalty tiers for signed-in guests, by visits in the last year.
// (No imports, so the browser, the server and the tests can all use it.)

export type TierId = "bronze" | "silver" | "gold";
export const TIERS: { id: TierId; name: string; icon: string; min: number; perks: string[] }[] = [
  { id: "bronze", name: "Bronze", icon: "🥉", min: 0, perks: ["Stamp card and birthday treat"] },
  { id: "silver", name: "Silver", icon: "🥈", min: 10, perks: ["A free size upgrade on one drink every order"] },
  { id: "gold", name: "Gold", icon: "🥇", min: 30, perks: ["Free size upgrades on every drink", "Your orders jump the queue"] },
];

export function tierFor(visits: number) {
  const i = [...TIERS].reverse().findIndex((t) => visits >= t.min);
  const tier = [...TIERS].reverse()[i];
  const next = TIERS[TIERS.indexOf(tier) + 1] ?? null;
  return { ...tier, visits, next: next ? { ...next, needed: next.min - visits } : null };
}
