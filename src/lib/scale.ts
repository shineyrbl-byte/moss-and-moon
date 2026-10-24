// Recipe scaler: "200 ml milk" × 2 = "400 ml milk". Pure, so the page and tests share it.
const FRAC: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
const NICE: [number, string][] = [[0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
const NUM = "(\\d+(?:\\.\\d+)?)?\\s*([¼½¾⅓⅔⅛])?";

/** "1½" → 1.5, "½" → 0.5, "2" → 2 */
const toNum = (whole?: string, frac?: string) => (whole ? Number(whole) : 0) + (frac ? FRAC[frac] : 0);
/** 1.5 → "1½", 0.333 → "⅓", 2.4 → "2.4" (and big amounts rounded) */
export function fmt(n: number) {
  if (n >= 20) return String(Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : Math.round(n / 5) * 5);
  const whole = Math.floor(n + 1e-9), rest = n - whole;
  if (rest < 0.04) return String(whole);
  const near = NICE.find(([v]) => Math.abs(v - rest) < 0.04);
  if (near) return `${whole || ""}${near[1]}`;
  return String(Math.round(n * 10) / 10);
}

/** Scale the amount at the start of a line (and "1 to 2" ranges). Lines without a number stay as they are. */
export function scaleLine(line: string, k: number) {
  if (k === 1) return line;
  const range = new RegExp(`^${NUM}\\s+to\\s+${NUM}(?=\\s)`).exec(line);
  if (range && (range[1] || range[2]) && (range[3] || range[4])) return `${fmt(toNum(range[1], range[2]) * k)} to ${fmt(toNum(range[3], range[4]) * k)}${line.slice(range[0].length)}`;
  const one = new RegExp(`^${NUM}(?=\\s|$)`).exec(line);
  if (!one || !(one[1] || one[2])) return line;
  return `${fmt(toNum(one[1], one[2]) * k)}${line.slice(one[0].length)}`;
}

const PLURAL: Record<string, string> = { glass: "glasses", mug: "mugs", cup: "cups", tumbler: "tumblers" };
/** "1 mug" × 2 = "2 mugs"; "About 4 glasses" × 2 = "About 8 glasses" */
export function scaleMakes(makes: string, k: number) {
  if (k === 1) return makes;
  const m = /^(about\s+)?(\d+)\s+(.*)$/i.exec(makes);
  if (!m) return `${makes} × ${fmt(k)}`;
  const n = Number(m[2]) * k;
  let rest = m[3];
  if (n > 1) rest = rest.replace(/\b(glass|mug|cup|tumbler)\b/, (w) => PLURAL[w]);
  else rest = rest.replace(/\b(glasses|mugs|cups|tumblers)\b/, (w) => Object.keys(PLURAL).find((s) => PLURAL[s] === w)!);
  return `${m[1] ?? ""}${fmt(n)} ${rest}`;
}
export const SCALES = [0.5, 1, 2, 3, 4];
