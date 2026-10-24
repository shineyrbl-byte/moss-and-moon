// Café connections: sort 16 words into 4 hidden groups of four. Pure, so the server and tests share it.
// The server picks the day's puzzle and checks guesses; the page only learns a group once it's found.
import { seededRand } from "./gameOrders.ts";

export const MISTAKES = 4;
export type Group = { name: string; words: [string, string, string, string] };
/** Groups go easiest first: level 0 (yellow) to level 3 (purple) */
export type Puzzle = [Group, Group, Group, Group];

const g = (name: string, w: string) => ({ name, words: w.split(" ") as Group["words"] });
export const PUZZLES: Puzzle[] = [
  [g("Espresso drinks", "LATTE MOCHA CORTADO MACCHIATO"), g("Games on our shelf", "CATAN UNO JENGA SCRABBLE"), g("Goa beaches", "BAGA CALANGUTE PALOLEM ANJUNA"), g("The moon is…", "WAXING WANING CRESCENT GIBBOUS")],
  [g("Milks we steam", "OAT ALMOND SOY COCONUT"), g("Pastries", "CROISSANT DANISH ECLAIR STRUDEL"), g("Ways to brew", "CHEMEX AEROPRESS MOKA SIPHON"), g("Spices in masala chai", "CARDAMOM CLOVE CINNAMON GINGER")],
  [g("Where coffee grows", "BRAZIL ETHIOPIA KENYA COLOMBIA"), g("___cake", "CUP CHEESE PAN SPONGE"), g("Card games", "RUMMY POKER BRIDGE SNAP"), g("Goan dishes", "XACUTI VINDALOO BEBINCA SORPOTEL")],
  [g("Teas we brew", "ASSAM DARJEELING NILGIRI OOLONG"), g("___ bean", "JELLY KIDNEY VANILLA BAKED"), g("Dog breeds", "BEAGLE PUG LABRADOR POODLE"), g("Café plants", "FERN MONSTERA POTHOS CACTUS")],
  [g("Syrups", "CARAMEL HAZELNUT MAPLE TOFFEE"), g("Goes with a cup", "SAUCER SLEEVE LID STRAW"), g("South Indian coffee hills", "COORG CHIKMAGALUR WAYANAD ARAKU"), g("Things you read", "NOVEL POEM ZINE COMIC")],
  [g("Planets", "MARS VENUS SATURN JUPITER"), g("Roasts", "LIGHT MEDIUM DARK BLONDE"), g("Ways to cook an egg", "POACHED SCRAMBLED FRIED BOILED"), g("Monsoon kit", "UMBRELLA RAINCOAT GUMBOOTS TORCH")],
  [g("___ moon", "HONEY BLUE HARVEST HALF"), g("Coffee tasting notes", "NUTTY FRUITY FLORAL SMOKY"), g("Board games", "CHESS LUDO CARROM MONOPOLY"), g("Breads", "POI FOCACCIA SOURDOUGH BRIOCHE")],
  [g("Barista jobs", "TAMP GRIND STEAM PULL"), g("On top of a cake", "SPRINKLES ICING GLAZE FONDANT"), g("Goa towns", "PANJIM MARGAO MAPUSA VASCO"), g("In a pencil case", "CRAYON ERASER SHARPENER RULER")],
  [g("Nuts", "CASHEW ALMOND WALNUT PISTACHIO"), g("Weather", "SUNNY CLOUDY MISTY BREEZY"), g("For the garden bed", "COMPOST MULCH SOIL PEBBLES"), g("Parts of a book", "SPINE COVER CHAPTER INDEX")],
  [g("Desserts", "BROWNIE TIRAMISU BEBINCA CHEESECAKE"), g("Kitchen tools", "WHISK LADLE SPATULA TONGS"), g("Constellations", "ORION PEGASUS LEO DRACO"), g("Instruments", "GUITAR UKULELE TABLA PIANO")],
  [g("Times of day", "DAWN NOON DUSK MIDNIGHT"), g("Summer fruit in Goa", "MANGO JACKFRUIT KOKUM JAMUN"), g("Sweeteners", "HONEY JAGGERY SUGAR STEVIA"), g("Places to sit", "STOOL BENCH SOFA ARMCHAIR")],
  [g("Cold drinks", "FRAPPE SMOOTHIE LASSI SHAKE"), g("Breakfast", "OMELETTE PANCAKE WAFFLE GRANOLA"), g("At the beach", "CRAB STARFISH JELLYFISH DOLPHIN"), g("Things you write with", "PEN PENCIL QUILL CHALK")],
];

const shuffle = <T,>(arr: T[], rand: () => number) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const dayNo = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400_000);

/** Today's puzzle: the list shuffled once by a fixed seed, then one a day in turn */
export function puzzleFor(date: string): Puzzle {
  const order = shuffle(PUZZLES, seededRand("moss-moon-connections"));
  return order[((dayNo(date) % order.length) + order.length) % order.length];
}
/** The 16 words in the order everyone sees today */
export const tilesFor = (date: string) => shuffle(puzzleFor(date).flatMap((x) => x.words), seededRand(`connections:${date}`));

/** Which group (0 to 3) a guess is, or null; `away` is how many words short of a group it got */
export function checkGuess(p: Puzzle, words: string[]): { level: number | null; away: number } {
  let best = 0;
  for (let level = 0; level < 4; level++) {
    const n = words.filter((w) => p[level].words.includes(w as never)).length;
    if (n === 4) return { level, away: 0 };
    best = Math.max(best, n);
  }
  return { level: null, away: 4 - best };
}
export const levelOf = (p: Puzzle, word: string) => p.findIndex((x) => x.words.includes(word as never));

const SQUARES = ["🟨", "🟩", "🟦", "🟪"];
/** The share text: one row per guess, coloured by the group each word really belongs to */
export const connectionsGrid = (p: Puzzle, guesses: string[][]) => guesses.map((gs) => gs.map((w) => SQUARES[levelOf(p, w)] ?? "⬜").join("")).join("\n");
