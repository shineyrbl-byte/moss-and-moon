// Around the corner: places near the café staff love. Owners edit the list in Admin.
export const SPOT_KINDS = [
  { id: "beach", icon: "🏖", label: "Beaches" },
  { id: "sunset", icon: "🌅", label: "Sunset spots" },
  { id: "books", icon: "📚", label: "Books & shops" },
  { id: "food", icon: "🍤", label: "Food & markets" },
  { id: "walk", icon: "🚶", label: "Walks" },
  { id: "other", icon: "📍", label: "Other" },
] as const;
export type SpotKind = (typeof SPOT_KINDS)[number]["id"];
export type Spot = { id: number; name: string; kind: SpotKind; blurb: string; walk_min: number; dog: boolean; map_url: string; sort: number };
export const kindOf = (k: unknown): SpotKind => (SPOT_KINDS.some((x) => x.id === k) ? (k as SpotKind) : "other");

/** A starting list to edit: swap these for real places near your café */
export const NEARBY_SEED: Omit<Spot, "id" | "sort">[] = [
  { name: "The beach steps", kind: "beach", blurb: "Down the lane and left at the banyan. Quiet before 9 and the sand is still cool.", walk_min: 6, dog: true, map_url: "" },
  { name: "Sunset rocks", kind: "sunset", blurb: "Flat rocks at the end of the beach. Bring a cold brew in a takeaway cup and be there by 6.", walk_min: 12, dog: true, map_url: "" },
  { name: "The second-hand bookshop", kind: "books", blurb: "Stacks to the ceiling and a cat on the counter. Trade in the book you finished on our shelf.", walk_min: 3, dog: false, map_url: "" },
  { name: "Saturday flea market", kind: "food", blurb: "Spices, cashews, handmade soap and the best bebinca. Goes on till late.", walk_min: 15, dog: true, map_url: "" },
  { name: "The morning fish market", kind: "food", blurb: "Go at 7 to see the boats come in. Noisy, busy and very Goan.", walk_min: 10, dog: false, map_url: "" },
  { name: "Chapel lane walk", kind: "walk", blurb: "Old Portuguese houses in blue and yellow, a whitewashed chapel and lots of bougainvillea.", walk_min: 8, dog: true, map_url: "" },
];
