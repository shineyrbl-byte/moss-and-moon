// Birthday & occasion shout-outs for the TV board. Pure checks, so the page, server and tests share them.
export const SHOUT_MAX = 80;
export const SHOUT_DAYS_AHEAD = 60;
export const SHOUT_PER_DAY = 12;
export const SHOUT_IDEAS = ["Happy birthday, Priya! 🎂", "Happy 10th anniversary, Ravi & Meera 💕", "Congrats on the new job, Sam! 🎉", "Welcome home, Dad ✈️"];
export function shoutProblem(text: string, date: string, today: string) {
  if (text.length < 5) return "A few more words, please.";
  if (text.length > SHOUT_MAX) return `Keep it to ${SHOUT_MAX} letters so it fits on the screen.`;
  if (/https?:|www\.|@\w|(\d[\s-]?){8,}/i.test(text)) return "No links, handles or phone numbers, please.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a day.";
  if (date < today) return "That day's already been.";
  if (Date.parse(date) - Date.parse(today) > SHOUT_DAYS_AHEAD * 86400_000) return `Up to ${SHOUT_DAYS_AHEAD} days ahead, please.`;
  return null;
}
