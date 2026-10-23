// The weekly poll: one light question a week. Staff can set their own; otherwise one of these comes round.
import { seededRand } from "./gameOrders.ts";

export const POLL_IDEAS: { q: string; choices: string[] }[] = [
  { q: "Best monsoon snack?", choices: ["Bhajiya", "Corn on the cob", "Samosa", "Cake and chai"] },
  { q: "How do you take your coffee?", choices: ["Black", "With milk", "Iced, always", "Sweet and creamy"] },
  { q: "Perfect café seat?", choices: ["By the window", "The sofa corner", "At the counter", "Out on the terrace"] },
  { q: "Beach time?", choices: ["Sunrise", "Lunchtime swim", "Sunset", "Night walk"] },
  { q: "Pick a pastry", choices: ["Croissant", "Cinnamon roll", "Banana bread", "Cookie"] },
  { q: "Chai or coffee?", choices: ["Chai", "Coffee", "Both, at once", "Neither, juice!"] },
  { q: "What's playing in the café?", choices: ["Old Bollywood", "Jazz", "Lo-fi beats", "Konkani songs"] },
  { q: "Best Goan dessert?", choices: ["Bebinca", "Serradura", "Dodol", "Bolinhas"] },
  { q: "Morning person?", choices: ["Up with the sun", "Only after coffee", "Mornings are a myth", "Depends on the day"] },
  { q: "Rainy day plan?", choices: ["Book and blanket", "Café hopping", "Long nap", "Dance in the rain"] },
  { q: "Pick a café game", choices: ["Carrom", "Codenames", "UNO", "Chess"] },
  { q: "Your ideal milk?", choices: ["Full-fat", "Oat", "Almond", "No milk"] },
];

/** The Monday a date's week starts on (YYYY-MM-DD) */
export function weekOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86400_000).toISOString().slice(0, 10);
}
/** The built-in question for a week */
export function ideaFor(week: string) {
  const rand = seededRand("moss-moon-poll");
  const order = [...POLL_IDEAS.keys()];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const n = Math.floor(Date.parse(`${week}T00:00:00Z`) / (7 * 86400_000));
  return POLL_IDEAS[order[((n % order.length) + order.length) % order.length]];
}
