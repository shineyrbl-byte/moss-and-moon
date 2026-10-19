// "A day in the life": pretend guests order every so often and their orders move through the
// barista screen on their own, so the screens and dashboards come alive without real customers.
// Everything it makes is flagged (orders.sim = 1) and can be cleared in one go.
import "server-only";
import { db, makeCode, getSetting, setSetting } from "./db";
import { getMenu, menuLookup } from "./menuStore";
import { defaultOptions, quote } from "./pricing";
import { withCosts } from "./profit";
import { TABLE_COUNT } from "./cafe";
import { publish } from "./live";
import { setOrderStatus } from "./orderFlow";

export const SIM_SPEEDS = { calm: 1, busy: 3, rush: 6 } as const; // orders a minute
export type SimSpeed = keyof typeof SIM_SPEEDS;
type Sim = { until: string; speed: SimSpeed };

const NAMES = ["Ananya", "Kabir", "Meera", "Rohan", "Isha", "Arjun", "Diya", "Vihaan", "Sara", "Aditya", "Tara", "Neel", "Riya", "Zoya", "Kiran", "Aarav", "Maya", "Dev", "Nisha", "Omar", "Leela", "Yash", "Pooja", "Siddharth"];
const STREETS = ["Fontainhas", "Altinho", "Campal", "Miramar", "Caranzalem", "Dona Paula"];
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export function simState(): (Sim & { on: boolean; orders: number }) {
  let s: Sim = { until: "", speed: "busy" };
  try { s = { ...s, ...JSON.parse(getSetting("sim") ?? "{}") }; } catch {}
  const orders = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE sim = 1").get() as { n: number }).n;
  return { ...s, on: !!s.until && new Date(s.until) > new Date(), orders };
}

export function startSim(minutes: number, speed: SimSpeed) {
  const m = Math.max(5, Math.min(240, Math.round(minutes)));
  setSetting("sim", JSON.stringify({ until: new Date(Date.now() + m * 60_000).toISOString(), speed }));
  simOrder(); // something to look at straight away
  return simState();
}

export function stopSim() {
  setSetting("sim", JSON.stringify({ ...simState(), until: "" }));
  return simState();
}

/** Remove every simulated order */
export function clearSim() {
  const n = db.prepare("DELETE FROM orders WHERE sim = 1").run().changes;
  publish({ type: "order", code: "", action: "status" });
  return n;
}

/** One pretend order: a drink or two, sometimes food, from a random channel */
export function simOrder() {
  const menu = getMenu().filter((m) => !m.soldOut && !m.groups?.length && m.cat !== "shop");
  const drinks = menu.filter((m) => ["coffee", "tea", "cold"].includes(m.cat));
  const food = menu.filter((m) => m.cat === "food" || m.cat === "bakes");
  if (!drinks.length) return null;
  const items = [pick(drinks), ...(Math.random() < 0.5 ? [pick(drinks)] : []), ...(Math.random() < 0.6 && food.length ? [pick(food)] : [])];
  const raw = items.map((m) => ({ itemId: m.id, opts: defaultOptions(m), qty: Math.random() < 0.15 ? 2 : 1 }));
  const find = menuLookup();
  const q = quote(raw, find, null, false, {});
  if (!q.lines.length) return null;
  const r = Math.random();
  const channel = r < 0.5 ? "pickup" : r < 0.75 ? "table" : r < 0.87 ? "delivery" : r < 0.94 ? "swiggy" : "zomato";
  const name = pick(NAMES);
  const table = channel === "table" ? 1 + Math.floor(Math.random() * TABLE_COUNT) : null;
  const address = channel === "delivery" ? `${10 + Math.floor(Math.random() * 80)} ${pick(STREETS)}, Panjim · 403001` : null;
  const platform = channel === "swiggy" || channel === "zomato" ? channel : null;
  const ref = platform ? String(100000000 + Math.floor(Math.random() * 899999999)) : null;
  const note = ["🎭 simulated", platform && `🛵 ${platform === "swiggy" ? "Swiggy" : "Zomato"} #${ref} · rider pickup`].filter(Boolean).join(" · ");
  const paid = platform || channel === "delivery" || Math.random() < 0.6;
  const code = makeCode("MM", 6);
  db.prepare(
    `INSERT INTO orders (code, name, phone, pickup, note, lines, subtotal, discount, total, pay_method, pay_status, table_no, delivery_address, source, source_ref, branch, sim)
     VALUES (?, ?, '', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'main', 1)`
  ).run(code, platform ? `${name} (${platform === "swiggy" ? "Swiggy" : "Zomato"})` : name, table ? "table" : address ? "delivery" : "asap", note,
    JSON.stringify(withCosts(q.lines, find)), q.subtotal, q.total, platform ?? (paid ? "online" : "counter"), paid ? "paid" : "unpaid", table, address, platform ?? "web", ref);
  publish({ type: "order", code, action: "new" });
  return code;
}

/** Every 10 s: maybe a new guest, and move simulated orders along like a busy barista would */
export function simTick() {
  const s = simState();
  if (s.on && Math.random() < SIM_SPEEDS[s.speed] / 6) simOrder();
  if (!s.orders) return;
  const rows = db.prepare("SELECT code, status, (julianday('now','localtime') - julianday(created_at)) * 86400 AS age FROM orders WHERE sim = 1 AND status != 'collected'").all() as { code: string; status: string; age: number }[];
  for (const o of rows) {
    // Received → brewing after ~40 s, ready after ~2½ min, collected ~1½ min later
    if (o.status === "received" && o.age > 40) setOrderStatus(o.code, "brewing");
    else if (o.status === "brewing" && o.age > 150) setOrderStatus(o.code, "ready");
    else if (o.status === "ready" && o.age > 240) setOrderStatus(o.code, "collected");
  }
}
