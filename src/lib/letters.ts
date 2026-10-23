// Letters to future you: write a note at the café, sealed for a few months. Pure date helpers.
export const LETTER_MONTHS = [3, 6, 12] as const;
export const LETTER_MAX = 2000;
export const SEALED_MAX = 10;

/** The day a letter opens: the same date a few months on (the 31st becomes the month's last day) */
export function openOn(from: string, months: number) {
  const [y, m, d] = from.split("-").map(Number);
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12), nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
export const isOpen = (open: string, today: string) => open <= today;
export function daysUntil(open: string, today: string) {
  return Math.max(0, Math.round((Date.parse(`${open}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400_000));
}
