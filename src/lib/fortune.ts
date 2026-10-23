// "Read your cup": a playful coffee-grounds fortune, one a day per person, coloured by the moon.
// Just for fun. Pure, so the page and tests share it.
import { seededRand } from "./gameOrders.ts";

export type MoonGroup = "new" | "waxing" | "full" | "waning";

/** Shapes you might "see" in the grounds, each with its old tasseography meaning */
export const SYMBOLS = [
  { icon: "🐦", name: "a bird", meaning: "news is on its way" },
  { icon: "🔑", name: "a key", meaning: "an answer you've been waiting for" },
  { icon: "❤️", name: "a heart", meaning: "someone is thinking of you" },
  { icon: "⭐", name: "a star", meaning: "a small wish coming true" },
  { icon: "🌳", name: "a tree", meaning: "steady growth, slow and sure" },
  { icon: "⚓", name: "an anchor", meaning: "you're on firm ground" },
  { icon: "⛵", name: "a little boat", meaning: "a trip, near or far" },
  { icon: "🌸", name: "a flower", meaning: "a happy surprise" },
  { icon: "⛰️", name: "a mountain", meaning: "a goal worth the climb" },
  { icon: "🌊", name: "a wave", meaning: "change, and it's a good one" },
  { icon: "🐟", name: "a fish", meaning: "luck by the sea" },
  { icon: "🪶", name: "a feather", meaning: "things will feel lighter soon" },
  { icon: "☀️", name: "a sun", meaning: "a bright, easy day" },
  { icon: "🌙", name: "a crescent", meaning: "trust your gut tonight" },
];

export const FORTUNES: Record<MoonGroup, string[]> = {
  new: [
    "A clean slate. Write down one small thing you want this month.",
    "Start the thing you keep putting off. Five minutes counts.",
    "Something new is quietly beginning. Give it room.",
    "Try a drink you've never ordered. It sets the tone.",
    "Plant a seed today: send the message, sign up for the class.",
    "Dark skies, fresh ideas. Keep a notebook close.",
  ],
  waxing: [
    "What you started is growing. Keep watering it.",
    "Say yes to the invitation. It leads somewhere nice.",
    "Your effort is showing, even if you can't see it yet.",
    "A good week to ask for help. People want to give it.",
    "Momentum is on your side. Don't stop for a long break.",
    "Add one more brick today. The wall is nearly up.",
  ],
  full: [
    "Everything is lit up tonight. Celebrate something, however small.",
    "You'll see clearly what you couldn't last week.",
    "Share your news. It's bigger than you think.",
    "A full cup, a full heart. Call someone you miss.",
    "Big feelings, big moon. Go easy on yourself.",
    "Whatever you've been building, it's ready to be seen.",
  ],
  waning: [
    "Let one thing go: a worry, a grudge, a cluttered drawer.",
    "Rest is part of the work. Take the slow morning.",
    "Finish before you start anything new.",
    "Say thank you to someone who helped this month.",
    "Tidy up, clear out, make space for what's coming.",
    "Quiet is good for you right now. Sit by the window.",
  ],
};

export function moonGroup(phaseId: string): MoonGroup {
  if (phaseId === "new") return "new";
  if (phaseId === "full") return "full";
  return phaseId.startsWith("waxing") || phaseId === "first-quarter" ? "waxing" : "waning";
}

/** Today's reading for one person (the same all day, different for each person) */
export function readCup(date: string, voter: string, phaseId: string) {
  const rand = seededRand(`cup:${date}:${voter}`);
  const group = moonGroup(phaseId);
  const symbol = SYMBOLS[Math.floor(rand() * SYMBOLS.length)];
  const text = FORTUNES[group][Math.floor(rand() * FORTUNES[group].length)];
  return { group, symbol, text, lucky: rand(), luckyNumber: 1 + Math.floor(rand() * 9) };
}
