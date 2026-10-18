// Coffee streaks and badges, worked out from a guest's orders.
// (No imports, so the browser, the server and the tests can all use it.)

export type BadgeOrder = { created_at: string; lines: { itemId: string; name: string; cat?: string; qty: number; opts?: { temp?: string } }[]; tip: number; hosted?: boolean };
export type BadgeExtras = { reviews: number; tickets: number; giftsSent: number };
export type Badge = { id: string; icon: string; name: string; desc: string; earned: boolean; progress?: { have: number; need: number } };

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (s: string) => s.slice(0, 10);
const prevDay = (d: string) => {
  const x = new Date(d + "T12:00");
  x.setDate(x.getDate() - 1);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

/** Current streak (days in a row with an order, ending today or yesterday) and the best ever */
export function streaks(orders: { created_at: string }[], today: string) {
  const days = [...new Set(orders.map((o) => dayOf(o.created_at)))].sort();
  let best = 0, run = 0, last = "";
  for (const d of days) {
    run = last && prevDay(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  const set = new Set(days);
  let current = 0;
  let d = set.has(today) ? today : prevDay(today);
  while (set.has(d)) {
    current++;
    d = prevDay(d);
  }
  return { current, best };
}

export function computeBadges(orders: BadgeOrder[], extras: BadgeExtras, today: string): { badges: Badge[]; streak: { current: number; best: number } } {
  const lines = orders.flatMap((o) => o.lines);
  const count = (f: (l: BadgeOrder["lines"][number]) => boolean) => lines.filter(f).reduce((s, l) => s + l.qty, 0);
  const hour = (o: BadgeOrder) => Number(o.created_at.slice(11, 13));
  const streak = streaks(orders, today);
  const make = (id: string, icon: string, name: string, desc: string, have: number, need: number): Badge => ({
    id, icon, name, desc, earned: have >= need, ...(need > 1 ? { progress: { have: Math.min(have, need), need } } : {}),
  });

  const badges = [
    make("first-sip", "🌱", "First sip", "Your first order", orders.length, 1),
    make("regular", "☕", "Regular", "10 orders", orders.length, 10),
    make("part-of-the-furniture", "🪴", "Part of the furniture", "50 orders", orders.length, 50),
    make("streak-3", "🔥", "On a roll", "Orders 3 days in a row", streak.best, 3),
    make("streak-7", "🌟", "Seven-day streak", "Orders 7 days in a row", streak.best, 7),
    make("early-bird", "🌅", "Early bird", "3 orders before 8am", orders.filter((o) => hour(o) < 8).length, 3),
    make("night-owl", "🦉", "Night owl", "3 orders after 7pm", orders.filter((o) => hour(o) >= 19).length, 3),
    make("matcha-lover", "🍵", "Matcha lover", "5 matcha drinks", count((l) => /matcha/i.test(l.name)), 5),
    make("iced-out", "🧊", "Iced out", "10 iced drinks", count((l) => l.opts?.temp === "iced"), 10),
    make("sweet-tooth", "🧁", "Sweet tooth", "10 bakes", count((l) => l.cat === "bakes"), 10),
    make("explorer", "🧭", "Explorer", "Tried 10 different things", new Set(lines.map((l) => l.itemId)).size, 10),
    make("generous", "💛", "Generous", "Tipped the team 5 times", orders.filter((o) => o.tip > 0).length, 5),
    make("host", "👯", "The host", "Started a group order", orders.filter((o) => o.hosted).length, 1),
    make("critic", "✍️", "Critic", "Left a review", extras.reviews, 1),
    make("night-out", "🎟", "Night out", "Came to a ticketed event", extras.tickets, 1),
    make("kind-soul", "🎁", "Kind soul", "Bought a friend a coffee", extras.giftsSent, 1),
  ];
  return { badges, streak };
}
