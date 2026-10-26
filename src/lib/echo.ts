// Barista's echo: the café plays a run of sounds, you play it back, and it grows by one each round. Pure, so the page and tests share it.
export const ECHO_MAX = 200;
export const PADS = [
  { id: "milk", emoji: "🥛", name: "Milk steamer", hz: 330 },
  { id: "cups", emoji: "☕", name: "Cups", hz: 392 },
  { id: "grinder", emoji: "⚙️", name: "Grinder", hz: 494 },
  { id: "till", emoji: "🔔", name: "Till", hz: 587 },
] as const;

/** Add one more sound to the run */
export const grow = (seq: number[], rand: () => number = Math.random) => [...seq, Math.floor(rand() * PADS.length)];

/** After the player's taps so far: still going, finished the round, or slipped up */
export function check(seq: number[], taps: number[]): "going" | "round" | "wrong" {
  for (let i = 0; i < taps.length; i++) if (taps[i] !== seq[i]) return "wrong";
  return taps.length === seq.length ? "round" : "going";
}

/** How long each sound plays, in ms: it speeds up as the run gets longer */
export const beatMs = (len: number) => Math.max(260, 620 - len * 22);
