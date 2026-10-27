// Mini crossword: a daily 5×5. Pure, so the page and tests share it.
// Grids are written row by row ("#" = black square); the numbering and answers are worked out from them.
import { rotationPick } from "./gameOrders.ts";

export const XW_SIZE = 5;
export const minMs = 15000;
/** Each grid's clues, keyed by the answer */
export const CROSSWORDS: { rows: string[]; clues: Record<string, string> }[] = [
  { rows: ["##ape", "#grin", "blend", "aunt#", "tea##"], clues: { ape: "Gorilla or chimp", grin: "A big smile", blend: "Our house coffee is one", aunt: "Your mum's sister, maybe", tea: "Darjeeling or Assam", bat: "Cricket kit", glue: "Craft-table sticker", arena: "Big stadium", pint: "A tub of ice cream, perhaps", end: "Finish" } },
  { rows: ["##pep", "#chai", "those", "wine#", "one##"], clues: { pep: "Get-up-and-go", chai: "Spiced milky tea", those: "Not these", wine: "Port, for one", one: "Table for ___?", two: "A pair", chin: "Just below the mouth", phone: "Ring us on it to order", ease: "Comfort", pie: "Pastry with a filling" } },
  { rows: ["##mug", "#tone", "fruit", "rent#", "yet##"], clues: { mug: "Big cup with a handle", tone: "Sound quality", fruit: "Mango or jackfruit", rent: "Monthly payment for a flat", yet: "So far", fry: "Cook in hot oil", tree: "A coconut palm is one", mount: "Climb on", unit: "A single thing", get: "Fetch" } },
  { rows: ["##hot", "#bone", "sauce", "else#", "ale##"], clues: { hot: "Like a fresh espresso", bone: "A pup's favourite treat", sauce: "Pasta topper", else: "Otherwise", ale: "Pub pint", sea: "The Arabian ___", ball: "Football, for one", house: "Home", once: "One time", tee: "Golf peg" } },
  { rows: ["##tea", "#moan", "boast", "else#", "get##"], clues: { tea: "Chamomile or hibiscus", moan: "Grumble", boast: "Brag", else: "Or ___!", get: "Receive", beg: "Plead", mole: "Little garden digger", toast: "Avocado on ___", ease: "Do it with ___ (no trouble)", ant: "Picnic pest" } },
  { rows: ["##sea", "#claw", "place", "oath#", "dye##"], clues: { sea: "What a beach shack looks out on", claw: "A crab's pincer", place: "Spot", oath: "Solemn promise", dye: "Colour a cloth", pod: "Pea holder", clay: "A potter's material", slate: "Old writing tablet", each: "Every one", awe: "Wonder" } },
  { rows: ["##jar", "#tube", "build", "once#", "way##"], clues: { jar: "Cookie holder", tube: "Toothpaste comes in one", build: "Put together", once: "___ upon a time", way: "Path", bow: "Ribbon knot", tuna: "Fish in a sandwich", juicy: "Like a ripe mango", able: "Capable", red: "Colour of a ripe tomato" } },
  { rows: ["##woo", "#sand", "child", "rosy#", "yet##"], clues: { woo: "Charm", sand: "Beach stuff", child: "Kid", rosy: "Pink and pretty", yet: "Still", cry: "Weep", shoe: "A sandal is one", waist: "Where an apron ties", only: "Just", odd: "Strange" } },
  { rows: ["##fig", "#tide", "shell", "pile#", "and##"], clues: { fig: "Sweet fruit, fresh or dried", tide: "It comes in and goes out", shell: "Beach find", pile: "Heap", and: "Plus", spa: "Pampering place", thin: "Slim", field: "Meadow", idle: "Doing nothing", gel: "Hair product" } },
  { rows: ["##ski", "#thin", "think", "wand#", "one##"], clues: { ski: "Glide on snow", thin: "Not thick", think: "Ponder", wand: "Magic stick", one: "A single", two: "A pair", than: "Bigger ___ life", shine: "Polish", kind: "Nice", ink: "What's in a pen" } },
  { rows: ["##egg", "#rare", "total", "obey#", "pen##"], clues: { egg: "Omelette basic", rare: "Not often seen", total: "The bill's sum", obey: "Follow the rules", pen: "Writer's tool", top: "Lid", robe: "Bath wrap", eaten: "Finished off, food-wise", gray: "Cloudy colour", gel: "Set, like jelly" } },
  { rows: ["##ice", "#pray", "loose", "aunt#", "dry##"], clues: { ice: "Iced coffee needs it", pray: "Hope very hard", loose: "Not tight", aunt: "A parent's sister", dry: "Not wet", lad: "Boy", pour: "Tip from the jug", irony: "Humour where the opposite is meant", cast: "Actors in a play", eye: "It sees" } },
];

export type Entry = { num: number; dir: "across" | "down"; cells: number[]; answer: string; clue: string };
/** Numbering and answers for a grid */
export function entriesOf(rows: string[], clues: Record<string, string>) {
  const n = rows.length, at = (r: number, c: number) => (r >= 0 && c >= 0 && r < n && c < n ? rows[r][c] : "#");
  const out: Entry[] = [], numbers: number[] = Array(n * n).fill(0);
  let num = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (at(r, c) === "#") continue;
    const a = at(r, c - 1) === "#" && at(r, c + 1) !== "#", d = at(r - 1, c) === "#" && at(r + 1, c) !== "#";
    if (!a && !d) continue;
    numbers[r * n + c] = ++num;
    for (const [dir, dr, dc] of [["across", 0, 1], ["down", 1, 0]] as const) {
      if (dir === "across" ? !a : !d) continue;
      const cells: number[] = [];
      for (let y = r, x = c; at(y, x) !== "#"; y += dr, x += dc) cells.push(y * n + x);
      const answer = cells.map((p) => rows[Math.floor(p / n)][p % n]).join("");
      out.push({ num, dir, cells, answer, clue: clues[answer] ?? "" });
    }
  }
  return { entries: out, numbers };
}

/** Today's grid: the same for everyone on a day */
export function crosswordFor(date: string) {
  const x = rotationPick(CROSSWORDS, "crossword", date);
  return { rows: x.rows, ...entriesOf(x.rows, x.clues) };
}
/** The solution as one string per square ("" for black) */
export const solutionOf = (rows: string[]) => rows.join("").split("").map((ch) => (ch === "#" ? "" : ch));
export const isSolved = (letters: string[], rows: string[]) => solutionOf(rows).every((s, i) => s === "" || (letters[i] ?? "").toLowerCase() === s);
