// When a daily-puzzle reminder is due. Times are minutes past midnight UTC, so every phone gets it at its own local time. Pure.
export const utcMinute = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
export const utcDay = (d: Date) => d.toISOString().slice(0, 10);
/** Local "HH:MM" plus the browser's getTimezoneOffset() → minutes past midnight UTC */
export function toUtcMin(local: string, offsetMin: number) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(local);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return (((+m[1] * 60 + +m[2] + offsetMin) % 1440) + 1440) % 1440;
}
/** Once a (UTC) day, at or after the chosen minute */
export const isDue = (atMin: number, last: string | null, now: Date) => last !== utcDay(now) && utcMinute(now) >= atMin;
