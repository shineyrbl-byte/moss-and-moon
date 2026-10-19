// Kitchen stations: drinks at the bar, food and bakes in the kitchen, each on its own tablet
export const STATIONS = [
  { id: "bar", label: "☕ Bar", cats: ["coffee", "tea", "cold", "shop"] },
  { id: "kitchen", label: "🍳 Kitchen", cats: ["food", "bakes"] },
] as const;
export type StationId = (typeof STATIONS)[number]["id"];
export const stationOf = (cat?: string): StationId => (STATIONS.find((s) => (s.cats as readonly string[]).includes(cat ?? "")) ?? STATIONS[0]).id;
/** Which stations an order needs */
export const stationsFor = (lines: { cat?: string }[]) => [...new Set(lines.map((l) => stationOf(l.cat)))];
