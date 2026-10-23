// The moon calendar: each night's phase for a month, and the year's full moons.
import { fullMoonNight, fullMoonsFrom, isFullMoonNight, moonNow, PHASES } from "./moon.ts";

/** Every night in a month (YYYY-MM): its phase at 9pm in India, and whether the full-moon cortado is on */
export function monthNights(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const at = new Date(Date.parse(`${date}T21:00:00+05:30`));
    const mn = moonNow(at);
    return { date, phase: mn.phase.id, icon: mn.phase.icon, lit: mn.lit, cortado: isFullMoonNight(date, 1) };
  });
}

/** The next full moons from a moment: exact time, and the night it belongs to in India */
export function nextFullMoons(from: Date, n = 12) {
  return fullMoonsFrom(from, n).map((d) => ({ at: d.getTime(), night: fullMoonNight(d) }));
}

export const PHASE_LABEL = Object.fromEntries(PHASES.map((p) => [p.id, p.label]));
