// The moon, worked out on the spot (no API). Full-moon times use Jean Meeus's
// "Astronomical Algorithms" (ch. 49), good to a few minutes. Pure, so the page, server and tests share it.

const SYNODIC = 29.530588861;
const IST = 5.5 * 3600_000;
const rad = (d: number) => (d * Math.PI) / 180;
const jdToMs = (jd: number) => (jd - 2440587.5) * 86400_000;
const msToJd = (ms: number) => ms / 86400_000 + 2440587.5;

/** The moment of full moon number k (k = integer + 0.5 counts full moons from Jan 2000) */
function fullMoonJd(k: number) {
  const T = k / 1236.85;
  let jde = 2451550.09766 + SYNODIC * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = rad(2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3);
  const Mp = rad(201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4);
  const F = rad(160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4);
  const O = rad(124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3);
  jde +=
    -0.40614 * Math.sin(Mp) + 0.17302 * E * Math.sin(M) + 0.01614 * Math.sin(2 * Mp) + 0.01043 * Math.sin(2 * F)
    + 0.00734 * E * Math.sin(Mp - M) - 0.00515 * E * Math.sin(Mp + M) + 0.00209 * E * E * Math.sin(2 * M)
    - 0.00111 * Math.sin(Mp - 2 * F) - 0.00057 * Math.sin(Mp + 2 * F) + 0.00056 * E * Math.sin(2 * Mp + M)
    - 0.00042 * Math.sin(3 * Mp) + 0.00042 * E * Math.sin(M + 2 * F) + 0.00038 * E * Math.sin(M - 2 * F)
    - 0.00024 * E * Math.sin(2 * Mp - M) - 0.00017 * Math.sin(O) - 0.00007 * Math.sin(Mp + 2 * M)
    + 0.00004 * Math.sin(2 * Mp - 2 * F) + 0.00004 * Math.sin(3 * M) + 0.00003 * Math.sin(Mp + M - 2 * F);
  return jde - 69 / 86400; // TT to UT, near enough
}

/** Full moons around a moment: the one before (or at) it and the one after */
function around(ms: number) {
  let k = Math.floor((msToJd(ms) - 2451550.09766) / SYNODIC) - 1 + 0.5;
  while (jdToMs(fullMoonJd(k + 1)) <= ms) k++;
  while (jdToMs(fullMoonJd(k)) > ms) k--;
  return { prev: jdToMs(fullMoonJd(k)), next: jdToMs(fullMoonJd(k + 1)), k };
}

/** The next few full moons from a moment, as exact times */
export function fullMoonsFrom(from: Date, n = 1): Date[] {
  const { k } = around(from.getTime());
  const out: Date[] = [];
  for (let i = 1; out.length < n; i++) out.push(new Date(jdToMs(fullMoonJd(k + i))));
  return out;
}

/** India date (YYYY-MM-DD) of a moment */
export const istDate = (ms: number) => new Date(ms + IST).toISOString().slice(0, 10);

/** The night a full moon belongs to: the evening before it if it rises after midnight, so the night in India it is fullest */
export const fullMoonNight = (at: Date) => istDate(at.getTime() - 12 * 3600_000);

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** Is this India date a full-moon night (or, with spread 1, the night before or after)? */
export function isFullMoonNight(date: string, spread = 0) {
  const mid = Date.parse(`${date}T18:30:00Z`); // midnight that night, in India
  const { prev, next } = around(mid);
  return [prev, next].some((f) => { const n = fullMoonNight(new Date(f)); return n >= addDays(date, -spread) && n <= addDays(date, spread); });
}

export const PHASES = [
  { id: "new", icon: "🌑", label: "New moon" },
  { id: "waxing-crescent", icon: "🌒", label: "Waxing crescent" },
  { id: "first-quarter", icon: "🌓", label: "First quarter" },
  { id: "waxing-gibbous", icon: "🌔", label: "Waxing gibbous" },
  { id: "full", icon: "🌕", label: "Full moon" },
  { id: "waning-gibbous", icon: "🌖", label: "Waning gibbous" },
  { id: "last-quarter", icon: "🌗", label: "Last quarter" },
  { id: "waning-crescent", icon: "🌘", label: "Waning crescent" },
] as const;

/** Tonight's moon: phase, how much is lit (0–100) and the next full-moon night */
export function moonNow(now = new Date()) {
  const { prev, next } = around(now.getTime());
  const sincePrevFull = (now.getTime() - prev) / (next - prev); // 0 = full, 0.5 = new
  const age = (sincePrevFull + 0.5) % 1; // 0 = new, 0.5 = full
  const lit = Math.round(((1 - Math.cos(2 * Math.PI * age)) / 2) * 100);
  const today = istDate(now.getTime());
  const fullTonight = isFullMoonNight(today);
  const idx = fullTonight ? 4 : Math.round(age * 8) % 8 === 4 ? (age < 0.5 ? 3 : 5) : Math.round(age * 8) % 8;
  // The next full-moon night after tonight (or tonight's, when it isn't full yet)
  const nights = [prev, next, ...fullMoonsFrom(new Date(next + 3600_000), 1).map((d) => d.getTime())].map((f) => fullMoonNight(new Date(f)));
  const nextFull = nights.find((n) => (fullTonight ? n > today : n >= today))!;
  const daysToFull = Math.round((Date.parse(`${nextFull}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400_000);
  return { phase: PHASES[idx], lit, fullTonight, nextFull, daysToFull };
}
