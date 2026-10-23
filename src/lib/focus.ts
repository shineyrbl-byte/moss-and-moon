// The focus corner's timer: work, short break, and a long break after every fourth round.
// Pure, so the page and tests share it.

export type FocusPlan = { id: string; label: string; work: number; short: number; long: number };
export const PLANS: FocusPlan[] = [
  { id: "classic", label: "25 / 5", work: 25, short: 5, long: 15 },
  { id: "deep", label: "50 / 10", work: 50, short: 10, long: 20 },
  { id: "sprint", label: "15 / 3", work: 15, short: 3, long: 10 },
];
export type Phase = "work" | "short" | "long";
export const ROUNDS_TO_LONG = 4;

/** What comes after a phase. `done` is how many work rounds are finished (including this one) */
export function nextPhase(phase: Phase, done: number): Phase {
  if (phase !== "work") return "work";
  return done > 0 && done % ROUNDS_TO_LONG === 0 ? "long" : "short";
}

export const phaseMinutes = (plan: FocusPlan, phase: Phase) => (phase === "work" ? plan.work : phase === "short" ? plan.short : plan.long);

/** 1500 → "25:00" */
export const clock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;
