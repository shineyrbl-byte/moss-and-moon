// Seasonal themes: the site dresses up by itself for festivals and seasons,
// with a banner, a little animation and a special drink. Owners can switch
// it off or preview a season from /admin → Overview.

export type SeasonId = "diwali" | "monsoon" | "christmas" | "valentines";
export type Season = {
  id: SeasonId;
  name: string;
  banner: string;
  particle: "diya" | "rain" | "snow" | "heart";
  /** Menu item that only appears during this season */
  drink: string;
};

export const SEASONS: Record<SeasonId, Season> = {
  diwali: { id: "diwali", name: "Diwali", banner: "🪔 Happy Diwali! Our Saffron Pista Latte is back for the festival", particle: "diya", drink: "saffron-pista-latte" },
  monsoon: { id: "monsoon", name: "Monsoon", banner: "🌧 Rainy-day mood: try our Monsoon Ginger Chai by the window", particle: "rain", drink: "monsoon-ginger-chai" },
  christmas: { id: "christmas", name: "Christmas", banner: "🎄 Merry Christmas! Gingerbread Lattes are here until New Year", particle: "snow", drink: "gingerbread-latte" },
  valentines: { id: "valentines", name: "Valentine's", banner: "💗 Valentine's week: share a Strawberry Rose Cloud (or two)", particle: "heart", drink: "strawberry-rose-cloud" },
};

// Diwali moves every year, so its dates are listed (the festival week around the main day)
const DIWALI: Record<number, string> = { 2026: "2026-11-08", 2027: "2027-10-29", 2028: "2028-10-17", 2029: "2029-11-05", 2030: "2030-10-26" };

const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate(); // e.g. 15 June = 615

/** Which season (if any) it is on this date */
export function seasonFor(date = new Date()): SeasonId | null {
  const main = DIWALI[date.getFullYear()];
  if (main) {
    const day = new Date(main + "T12:00");
    const diff = (date.getTime() - day.getTime()) / 86_400_000;
    if (diff >= -5 && diff <= 4) return "diwali";
  }
  const x = md(date);
  if (x >= 1215 || x <= 101) return "christmas";
  if (x >= 207 && x <= 214) return "valentines";
  if (x >= 615 && x <= 915) return "monsoon";
  return null;
}

/** "auto" follows the calendar, "off" never decorates, or a season id to preview it */
export type SeasonSetting = "auto" | "off" | SeasonId;
export const isSeasonSetting = (v: unknown): v is SeasonSetting => v === "auto" || v === "off" || (typeof v === "string" && v in SEASONS);

export function activeSeason(setting: SeasonSetting = "auto", date = new Date()): SeasonId | null {
  if (setting === "off") return null;
  if (setting !== "auto") return setting;
  return seasonFor(date);
}

/** Seasonal drinks, added to the menu once (owners can edit or delete them like any item) */
export const SEASONAL_ITEMS = [
  { id: "saffron-pista-latte", cat: "coffee", name: "Saffron Pista Latte", desc: "Kesar-steeped milk, pistachio and a double shot. Our Diwali favourite.", price: 270, img: "1517487881594-2787fef5ebf7", badge: "new", season: "diwali", traits: { energy: 1, sweet: 2, temp: "hot" } },
  { id: "monsoon-ginger-chai", cat: "tea", name: "Monsoon Ginger Chai", desc: "Strong Assam, fresh ginger and tulsi. Made for rainy windows.", price: 160, img: "1544787219-7f47ccb76574", badge: "new", season: "monsoon", diet: ["gf"], traits: { energy: 1, sweet: 1, temp: "hot" } },
  { id: "gingerbread-latte", cat: "coffee", name: "Gingerbread Latte", desc: "Molasses, cinnamon and nutmeg with espresso and a cookie crumb top.", price: 260, img: "1572442388796-11668a67e53d", badge: "new", season: "christmas", traits: { energy: 1, sweet: 2, temp: "hot" } },
  { id: "strawberry-rose-cloud", cat: "tea", name: "Strawberry Rose Cloud", desc: "Iced strawberry milk, rose and a fluffy pink cream cloud.", price: 240, img: "1488477181946-6428a0291777", badge: "pink pick", season: "valentines", diet: ["gf"], traits: { energy: 0, sweet: 2, temp: "iced" } },
] as const;
