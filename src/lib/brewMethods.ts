// Brew timer methods. Each step starts at `at` seconds; `water` is the total poured by the end
// of that step, as a share of the full amount (so it scales with how much coffee you use).
export type BrewStep = { at: number; label: string; water?: number };
export type BrewMethod = { id: string; name: string; icon: string; ratio: number; dose: number; grind: string; temp: string; steps: BrewStep[]; total: number; note: string };

export const BREW_METHODS: BrewMethod[] = [
  {
    id: "v60", name: "Pour-over (V60)", icon: "☕", ratio: 16, dose: 15, grind: "Medium-fine, like table salt", temp: "93°C (just off the boil)",
    steps: [
      { at: 0, label: "Bloom: pour just enough to wet all the coffee", water: 0.18 },
      { at: 10, label: "Let it bloom and bubble" },
      { at: 45, label: "Pour slowly in circles", water: 0.6 },
      { at: 75, label: "Pour the rest, gently", water: 1 },
      { at: 105, label: "Let it drip through. Give the dripper a little swirl" },
    ],
    total: 180, note: "Done when the bed is flat and it stops dripping, around 3 minutes.",
  },
  {
    id: "aeropress", name: "AeroPress", icon: "🧪", ratio: 13, dose: 15, grind: "Medium", temp: "85°C",
    steps: [
      { at: 0, label: "Pour all the water in", water: 1 },
      { at: 15, label: "Stir 5 times" },
      { at: 25, label: "Put the plunger on and let it steep" },
      { at: 90, label: "Press down slowly and steadily" },
    ],
    total: 120, note: "Stop pressing when you hear a hiss.",
  },
  {
    id: "french-press", name: "French press", icon: "🫖", ratio: 15, dose: 30, grind: "Coarse, like breadcrumbs", temp: "95°C",
    steps: [
      { at: 0, label: "Pour all the water in", water: 1 },
      { at: 30, label: "Lid on and leave it to steep" },
      { at: 240, label: "Stir the crust and scoop off the foam" },
      { at: 270, label: "Plunge gently and pour straight away" },
    ],
    total: 300, note: "Pour it all out so it doesn't keep brewing and turn bitter.",
  },
  {
    id: "moka", name: "Moka pot", icon: "🔥", ratio: 7, dose: 18, grind: "Fine, but not powder", temp: "Start with hot water",
    steps: [
      { at: 0, label: "Medium-low heat, lid open, and watch", water: 1 },
      { at: 180, label: "Coffee starts flowing, keep the heat low" },
      { at: 240, label: "It gurgles: take it off and cool the base under the tap" },
    ],
    total: 260, note: "Cooling the base stops it boiling over and tasting burnt.",
  },
];

export const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

/** The step you're on at `t` seconds (or -1 before starting) */
export const stepAt = (m: BrewMethod, t: number) => m.steps.reduce((cur, s, i) => (t >= s.at ? i : cur), -1);
