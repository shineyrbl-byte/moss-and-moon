// Quiz night: one live quiz for the whole café, hosted by staff. Pure, so the server, pages and tests share it.
export const QUIZ_SIZES = [5, 10, 15] as const;
/** Points for a right answer: 500, plus up to 500 more for being quick */
export const points = (ms: number, qMs: number) => Math.round(500 + 500 * Math.max(0, Math.min(1, 1 - ms / qMs)));
export const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 20) : "");
