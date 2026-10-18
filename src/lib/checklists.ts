// Opening and closing checklists, ticked off (and signed) by whoever is on shift
import "server-only";
import { db, getSetting, setSetting } from "./db";

export const LISTS = [
  { id: "opening", label: "Opening", icon: "🌅" },
  { id: "closing", label: "Closing", icon: "🌙" },
] as const;
export type ListId = (typeof LISTS)[number]["id"];
/** "temp" items ask for a fridge reading; above this it's flagged */
export const FRIDGE_MAX = 5;

const SEED: { list: ListId; text: string; kind?: "tick" | "temp" }[] = [
  { list: "opening", text: "Espresso machine on, flushed, first shot dialled in (18 g → 36 g, 25–30 s)" },
  { list: "opening", text: "Grinder hopper filled; yesterday's open milk checked" },
  { list: "opening", text: "Milk fridge temperature", kind: "temp" },
  { list: "opening", text: "Display fridge temperature", kind: "temp" },
  { list: "opening", text: "Pastries out with labels and allergen cards" },
  { list: "opening", text: "Tables, chairs and the counter wiped; floor swept" },
  { list: "opening", text: "Till float counted (see Cash-up)" },
  { list: "opening", text: "Washroom checked: soap, towels, clean" },
  { list: "closing", text: "Leftover bakes logged in Waste" },
  { list: "closing", text: "Group heads backflushed with cleaner; steam wands purged and wiped" },
  { list: "closing", text: "Grinder brushed out; hoppers closed" },
  { list: "closing", text: "Milk fridge temperature", kind: "temp" },
  { list: "closing", text: "Open milk dated or thrown away" },
  { list: "closing", text: "Dishes done; bins emptied and new bags in" },
  { list: "closing", text: "Floor mopped" },
  { list: "closing", text: "Cash-up done" },
  { list: "closing", text: "Lights, AC and machines off; doors locked" },
];

export function seedChecklists() {
  if (getSetting("seeded_checklists")) return;
  const add = db.prepare("INSERT INTO checklist_items (list, text, kind, sort) VALUES (?, ?, ?, ?)");
  SEED.forEach((x, i) => add.run(x.list, x.text, x.kind ?? "tick", i));
  setSetting("seeded_checklists", "1");
}

type Item = { id: number; list: ListId; text: string; kind: "tick" | "temp"; sort: number };
type Tick = { item_id: number; staff_name: string | null; value: number | null; done_at: string };

export function dayChecklists(day: string) {
  seedChecklists();
  const items = db.prepare("SELECT id, list, text, kind, sort FROM checklist_items WHERE active = 1 ORDER BY sort, id").all() as Item[];
  const ticks = new Map((db.prepare("SELECT item_id, staff_name, value, done_at FROM checklist_ticks WHERE day = ?").all(day) as Tick[]).map((t) => [t.item_id, t]));
  return LISTS.map((l) => {
    const list = items.filter((i) => i.list === l.id).map((i) => ({ ...i, done: ticks.get(i.id) ?? null, warn: i.kind === "temp" && (ticks.get(i.id)?.value ?? 0) > FRIDGE_MAX }));
    return { ...l, items: list, done: list.filter((i) => i.done).length, total: list.length };
  });
}

/** For the nightly email: how complete each list was */
export function checklistSummary(day: string) {
  const lists = dayChecklists(day);
  const warm = lists.flatMap((l) => l.items.filter((i) => i.warn).map((i) => `${i.text}: ${i.done!.value} °C`));
  return { lists: lists.map((l) => ({ label: l.label, done: l.done, total: l.total })), warm };
}

/** Last 14 days: done out of total, per list */
export function checklistHistory() {
  const rows = db.prepare(
    `SELECT t.day, i.list, COUNT(*) AS done FROM checklist_ticks t JOIN checklist_items i ON i.id = t.item_id
     WHERE t.day >= date('now','localtime','-13 days') GROUP BY t.day, i.list ORDER BY t.day DESC`,
  ).all() as { day: string; list: ListId; done: number }[];
  return rows;
}
