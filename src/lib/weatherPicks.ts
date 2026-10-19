// Which drinks suit the weather outside. Pure (no server bits), so the home page and tests can use it.
export type Weather = { temp: number; code: number; isDay: boolean };
export type Mood = "rain" | "hot" | "cool" | "nice";
type Dish = { id: string; soldOut?: boolean; hidden?: boolean };

/** Open-Meteo weather codes: 51–67 drizzle/rain, 80–82 showers, 95–99 thunderstorms */
export const isRainy = (code: number) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

export function moodFor(w: Weather): Mood {
  if (isRainy(w.code)) return "rain";
  if (w.temp >= 31) return "hot";
  if (w.temp < 23) return "cool";
  return "nice";
}

const PICKS: Record<Mood, string[]> = {
  rain: ["monsoon-ginger-chai", "chai", "samosa-plate", "masala-bhutta", "hot-chocolate", "filter-kaapi", "ginger-lemon-honey", "pav-bhaji"],
  hot: ["kokum-granita", "kokum-soda", "watermelon-cooler", "nimbu-pani", "mango-cold-brew", "cold-brew", "coconut-espresso", "sol-kadhi"],
  cool: ["hot-chocolate", "turmeric-latte", "chai", "kahwa", "cappuccino", "cinnamon-roll"],
  nice: ["rose-latte", "iced-brown-sugar", "honey-oat-latte", "cold-brew", "croissant", "strawberry-mojito"],
};

/** Up to `n` dishes on today's menu that fit the weather */
export function weatherPicks<T extends Dish>(w: Weather, menu: T[], n = 4): { mood: Mood; items: T[] } {
  const mood = moodFor(w);
  const byId = new Map(menu.filter((m) => !m.soldOut && !m.hidden).map((m) => [m.id, m]));
  return { mood, items: PICKS[mood].map((id) => byId.get(id)).filter((m): m is T => !!m).slice(0, n) };
}
