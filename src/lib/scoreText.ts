// How to show a saved daily score: most are times, but a few pack moves, words or points in. Pure.
import { clock } from "./memory.ts";

export function scoreText(game: string, ms: number): string {
  const packed = { moves: Math.floor(ms / 1_000_000), ms: ms % 1_000_000 };
  if (game === "flood") return `${packed.moves} moves · ${clock(packed.ms)}`;
  if (game === "corners") return `${packed.moves} words · ${clock(packed.ms)}`;
  if (game === "bill") return `${packed.moves ? `${packed.moves} off` : "spot on"} · ${clock(packed.ms)}`;
  if (game === "boggle") return `${1_000_000 - ms} pts`;
  return clock(ms);
}
