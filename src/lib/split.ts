// Split the bill: who had what, shared things split evenly, rounded so the shares add up exactly. Pure, so the page and tests share it.
export type SplitItem = { name: string; price: number; qty: number; people: number[] };

/** Split whole rupees into n shares that add back up (the first ones get any extra rupee) */
export function fairShares(total: number, n: number) {
  const base = Math.floor(total / n), extra = total - base * n;
  return [...Array(n).keys()].map((i) => base + (i < extra ? 1 : 0));
}
/** Each person's share in rupees. Tip is a percentage spread in proportion to what each person had. */
export function splitBill(items: SplitItem[], people: number, tipPct = 0) {
  const own = Array(people).fill(0) as number[];
  let unassigned = 0;
  for (const it of items) {
    const total = Math.round(it.price * it.qty);
    const who = it.people.filter((p) => p >= 0 && p < people);
    if (!who.length) { unassigned += total; continue; }
    // The extra rupee goes to whoever has had least so far, so it evens out
    const order = [...who].sort((a, b) => own[a] - own[b] || a - b);
    fairShares(total, who.length).forEach((s, i) => (own[order[i]] += s));
  }
  const subtotal = own.reduce((a, b) => a + b, 0);
  const tip = Math.round((subtotal * Math.max(0, Math.min(tipPct, 50))) / 100);
  // Tip in proportion, with leftover rupees going to the biggest shares
  const raw = own.map((o) => (subtotal ? (o * tip) / subtotal : 0));
  const tips = raw.map(Math.floor);
  let left = tip - tips.reduce((a, b) => a + b, 0);
  for (const i of [...raw.keys()].sort((a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])) || own[b] - own[a])) { if (left <= 0) break; tips[i]++; left--; }
  return { shares: own.map((o, i) => o + tips[i]), own, tips, subtotal, tip, total: subtotal + tip, unassigned };
}
