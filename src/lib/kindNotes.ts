// Notes for a stranger: write a kind note, get one back. Pure, so the server and tests share it.
export const NOTE_MAX = 200;
/** Ours, for when no guest notes are ready to hand out yet */
export const HOUSE_NOTES = [
  "Whatever you're carrying today, you don't have to carry it all at once. Drink your coffee slowly.",
  "Someone is glad you exist, even if they haven't said it this week.",
  "You're allowed to rest before you're finished.",
  "The fact that you'd read a note from a stranger says something lovely about you.",
  "Small steps still get you there. Today counts.",
  "Text the friend you were thinking about. They're probably thinking of you too.",
  "You've survived every hard day so far. That's a perfect record.",
  "Go and look at the sky tonight. It's free and it's always worth it.",
];
/** Keeps notes readable: no links, no phone numbers, no angle brackets */
export function noteProblem(text: string) {
  if (text.length < 10) return "A few more words, please.";
  if (/https?:|www\.|\.com\b|@\w/i.test(text)) return "No links or handles, please. Just the note.";
  if (/(\d[\s-]?){8,}/.test(text)) return "No phone numbers, please. Keep it anonymous.";
  return null;
}
