// Equipment: service reminders and a repair log (repair costs go into P&L as expenses)
import "server-only";
import { db, getSetting, setSetting } from "./db";
import { toDateStr } from "./cafe";

export type Equipment = { id: number; name: string; task: string; every_days: number; last_done: string | null };
const SEED = [
  { name: "Espresso machine", task: "Descale and change gaskets", every: 90 },
  { name: "Espresso machine", task: "Replace the water filter", every: 60 },
  { name: "Grinder", task: "Deep clean the burrs", every: 30 },
  { name: "Milk fridge", task: "Clean the coils and seals", every: 90 },
  { name: "Blender", task: "Check the blade and jug seal", every: 60 },
];

export function seedEquipment() {
  if (getSetting("seeded_equipment")) return;
  const today = toDateStr(new Date());
  const add = db.prepare("INSERT INTO equipment (name, task, every_days, last_done) VALUES (?, ?, ?, ?)");
  for (const e of SEED) add.run(e.name, e.task, e.every, today);
  setSetting("seeded_equipment", "1");
}

const addDays = (day: string, n: number) => { const d = new Date(day + "T12:00"); d.setDate(d.getDate() + n); return toDateStr(d); };

export function equipmentList() {
  seedEquipment();
  const today = toDateStr(new Date());
  return (db.prepare("SELECT id, name, task, every_days, last_done FROM equipment WHERE active = 1 ORDER BY name, id").all() as Equipment[]).map((e) => {
    const due = addDays(e.last_done ?? today, e.every_days);
    const daysLeft = Math.round((new Date(due + "T12:00").getTime() - new Date(today + "T12:00").getTime()) / 86_400_000);
    return { ...e, due, daysLeft, overdue: daysLeft < 0, soon: daysLeft >= 0 && daysLeft <= 7 };
  });
}

export const dueEquipment = () => equipmentList().filter((e) => e.daysLeft <= 0);

export function equipmentLog(limit = 30) {
  return db.prepare("SELECT l.id, l.kind, l.note, l.cost, l.staff_name, l.created_at, e.name, e.task FROM equipment_log l JOIN equipment e ON e.id = l.equipment_id ORDER BY l.id DESC LIMIT ?").all(limit);
}

/** Mark a service done, or log a repair (its cost becomes a "repairs" expense for the month) */
export function logEquipment(id: number, kind: "service" | "repair", note: string, cost: number, staffName: string) {
  const e = db.prepare("SELECT id, name FROM equipment WHERE id = ? AND active = 1").get(id) as { id: number; name: string } | undefined;
  if (!e) return false;
  db.prepare("INSERT INTO equipment_log (equipment_id, kind, note, cost, staff_name) VALUES (?, ?, ?, ?, ?)").run(id, kind, note || null, cost, staffName);
  if (kind === "service") db.prepare("UPDATE equipment SET last_done = ? WHERE id = ?").run(toDateStr(new Date()), id);
  if (cost > 0) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    db.prepare("INSERT INTO expenses (month, category, label, amount, recurring) VALUES (?, 'repairs', ?, ?, 0)").run(month, `${e.name}${note ? `: ${note}` : ""}`.slice(0, 80), cost);
  }
  return true;
}
