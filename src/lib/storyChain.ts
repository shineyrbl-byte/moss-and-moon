// Story chain: a story written one sentence at a time by different guests. Pure, so the server and tests share it.
export const CHAIN_LINES = 20;
export const LINE_MAX = 160;
/** How each new story starts, in turn */
export const OPENERS = [
  "The last customer of the night ordered a drink nobody had ever heard of.",
  "Every full moon, the plant by the window grew one new leaf, and this time it was silver.",
  "The barista found a note tucked under a saucer that simply said: \"Don't open the third cupboard.\"",
  "It had rained for nine days straight when the stranger with the dry umbrella walked in.",
  "Nobody knew who kept leaving one perfect croissant on the bench outside each morning.",
  "The café's old clock stopped at 4:17, and so did everyone inside except Mira.",
  "A dog wandered in, sat at table six, and refused to leave until someone read it a story.",
  "The new coffee beans came with a map instead of a label.",
];
export function lineProblem(text: string) {
  if (text.length < 8) return "A few more words, please. One full sentence.";
  if (text.length > LINE_MAX) return `Keep it to one sentence (${LINE_MAX} letters).`;
  if (/https?:|www\.|@\w/i.test(text)) return "No links or handles, please.";
  if ((text.match(/[.!?](\s|$)/g) ?? []).length > 2) return "Just one sentence, so others can carry it on.";
  return null;
}
