// Calendar files (.ics) and "add to Google Calendar" links, for bookings, events and cake pickups.
// Pure, so the email code, the pages and tests share it. Times are India time.

export type CalEvent = { uid: string; title: string; date: string; time: string; minutes: number; location?: string; details?: string; alarmMinutes?: number };

const p = (n: number) => String(n).padStart(2, "0");
/** Local wall-clock start and end, like 20261024T110000 */
function span(e: CalEvent) {
  const [y, mo, d] = e.date.split("-").map(Number);
  const [h, mi] = e.time.split(":").map(Number);
  const end = new Date(Date.UTC(y, mo - 1, d, h, mi + e.minutes));
  const f = (x: Date) => `${x.getUTCFullYear()}${p(x.getUTCMonth() + 1)}${p(x.getUTCDate())}T${p(x.getUTCHours())}${p(x.getUTCMinutes())}00`;
  return { start: f(new Date(Date.UTC(y, mo - 1, d, h, mi))), end: f(end) };
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export const DEFAULT_LOCATION = "Moss & Moon, 14 Willow Lane";

export function icsText(e: CalEvent, stamp = new Date()) {
  const { start, end } = span(e);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Moss & Moon//Calendar//EN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@mossandmoon`,
    `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=Asia/Kolkata:${start}`,
    `DTEND;TZID=Asia/Kolkata:${end}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location ?? DEFAULT_LOCATION)}`,
    ...(e.details ? [`DESCRIPTION:${esc(e.details)}`] : []),
    ...(e.alarmMinutes ? ["BEGIN:VALARM", `TRIGGER:-PT${e.alarmMinutes}M`, "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "END:VALARM"] : []),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function googleCalUrl(e: CalEvent) {
  const { start, end } = span(e);
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${start}/${end}`, ctz: "Asia/Kolkata", location: e.location ?? DEFAULT_LOCATION, details: e.details ?? "" });
  return `https://calendar.google.com/calendar/render?${q}`;
}
