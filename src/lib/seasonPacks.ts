// Season packs: while the café's dressed up for Diwali, Christmas or the monsoon, there's a pack of themed puzzles:
// three colour pictures and a list of themed words for hangman. Finishing the pictures puts your time on that
// season's board. Pure (the pictures all solve line by line; the tests check).
import { seasonFor } from "./seasons.ts";

export type PackId = "diwali" | "christmas" | "monsoon";
export type Pack = { id: PackId; title: string; emoji: string; blurb: string; pictures: { name: string; rows: string[] }[]; words: Record<string, string> };
export const PACKS: Record<PackId, Pack> = {
  diwali: {
    id: "diwali", title: "Diwali pack", emoji: "🪔", blurb: "Lights, lanterns and rangoli for the festival of lights.",
    pictures: [
      { name: "A diya", rows: ["...y....", "...yy...", "..yry...", "...y....", "........", "pppppppp", ".pbbbbp.", "..pppp.."] },
      { name: "A lantern", rows: ["...bb...", "..pppp..", ".pyyyyp.", "pyyrryyp", "pyyrryyp", ".pyyyyp.", "..pppp..", "...rr..."] },
      { name: "A rangoli", rows: ["...pp...", "..pyyp..", ".pyrryp.", "pyrggryp", "pyrggryp", ".pyrryp.", "..pyyp..", "...pp..."] },
    ],
    words: { diya: "A little clay lamp", rangoli: "Coloured patterns at the door", lantern: "Hanging paper light", sparkler: "A firework you hold", mithai: "Indian sweets", ladoo: "A round sweet", jalebi: "Syrupy orange spirals", candles: "Wax lights", marigold: "Orange festival flower", lights: "They're strung everywhere" },
  },
  christmas: {
    id: "christmas", title: "Christmas pack", emoji: "🎄", blurb: "Trees, presents and stockings for Christmas.",
    pictures: [
      { name: "A Christmas tree", rows: ["...y....", "...g....", "..ggg...", ".ggrgg..", "..ggg...", ".ggggg..", "gggrggg.", "...b...."] },
      { name: "A present", rows: ["..r..r..", "...rr...", "pppprppp", "pppprppp", "rrrrrrrr", "pppprppp", "pppprppp", "pppprppp"] },
      { name: "A stocking", rows: ["..pppp..", "..rrrr..", "..rrrr..", "..rrrr..", "..rrrr..", ".rrrrr..", "rrrrrr..", "rrrr...."] },
    ],
    words: { reindeer: "Santa's team", stocking: "Hung up for presents", tinsel: "Shiny tree trimming", carols: "Christmas songs", snowman: "Built in the garden", mistletoe: "Kiss under it", plumcake: "Goa's favourite Christmas bake", bebinca: "Layered Goan dessert", wreath: "A ring on the door", presents: "Under the tree" },
  },
  monsoon: {
    id: "monsoon", title: "Monsoon pack", emoji: "☔", blurb: "Umbrellas, clouds and wellies for the rains.",
    pictures: [
      { name: "An umbrella", rows: ["...pp...", ".pppppp.", "pppppppp", "pppppppp", "...b....", "...b....", ".b.b....", ".bb....."] },
      { name: "A rain cloud", rows: ["........", "..pp....", ".pppp.p.", "pppppppp", "........", ".g.g.g..", "g.g.g.g.", "........"] },
      { name: "Wellies", rows: ["........", ".yy.....", ".yy..yy.", ".yy..yy.", ".yyy.yy.", ".yyy.yyy", "........", "gggggggg"] },
    ],
    words: { puddle: "Jump in it", thunder: "Rumble in the sky", raincoat: "Keeps you dry", chai: "Best with the rain", pakora: "Fried monsoon snack", drizzle: "Light rain", umbrella: "Open it up", lightning: "A flash in the sky", rainbow: "After the storm", monsoon: "The rainy season" },
  },
};
/** The pack running today (Diwali, Christmas or the monsoon), or null */
export function packToday(date = new Date()): PackId | null {
  const s = seasonFor(date);
  return s === "diwali" || s === "christmas" || s === "monsoon" ? s : null;
}
/** Which board a season's times go on: the season and the year it started */
export function seasonKey(date: Date, id: PackId) {
  const y = id === "christmas" && date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear();
  return `${y}-${id}`;
}
