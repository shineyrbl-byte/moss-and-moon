// Who's trained on which station, and a quick recipe quiz built from the recipe cards
import "server-only";
import crypto from "node:crypto";
import { db, getSetting, setSetting } from "./db";
import { allRecipes, seedRecipes } from "./recipes";
import { menuLookup } from "./menuStore";

export const STATIONS = [
  { id: "espresso", label: "Espresso & grinder" },
  { id: "milk", label: "Milk & latte art" },
  { id: "tea", label: "Tea & matcha" },
  { id: "cold", label: "Cold drinks & blender" },
  { id: "food", label: "Food & toasties" },
  { id: "till", label: "Till & cash-up" },
  { id: "opening", label: "Opening" },
  { id: "closing", label: "Closing" },
] as const;
export const QUIZ_LENGTH = 5;
export const QUIZ_PASS = 4;

export function trainingMatrix() {
  const team = db.prepare("SELECT id, name, role FROM staff WHERE active = 1 ORDER BY name").all() as { id: number; name: string; role: string }[];
  const done = db.prepare("SELECT staff_id, station, signed_by, at FROM training").all() as { staff_id: number; station: string; signed_by: string | null; at: string }[];
  const quiz = db.prepare("SELECT staff_id, MAX(score) AS best, COUNT(*) AS tries, MAX(at) AS last FROM quiz_results GROUP BY staff_id").all() as { staff_id: number; best: number; tries: number; last: string }[];
  return team.map((t) => ({
    ...t,
    stations: Object.fromEntries(done.filter((d) => d.staff_id === t.id).map((d) => [d.station, { by: d.signed_by, at: d.at.slice(0, 10) }])),
    quiz: quiz.find((q) => q.staff_id === t.id) ?? null,
  }));
}

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

/** Five "which drink is this?" questions: the recipe's steps, and four drinks to pick from */
export function makeQuiz() {
  if (getSetting("seeded_recipes_v3") !== "1") { seedRecipes(); setSetting("seeded_recipes", "1"); setSetting("seeded_recipes_v3", "1"); }
  const find = menuLookup();
  const recipes = Object.entries(allRecipes()).filter(([id]) => find(id));
  const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
  return shuffle(recipes).slice(0, QUIZ_LENGTH).map(([id, text]) => {
    // Leave out lines that give the name away
    const name = find(id)!.name.toLowerCase();
    const steps = text.split("\n").filter(Boolean).map((l) => (l.toLowerCase().includes(name) ? "…" : l));
    const wrong = shuffle(recipes.filter(([x]) => x !== id)).slice(0, 3).map(([x]) => x);
    return { key: hash(text), steps, options: shuffle([id, ...wrong]).map((x) => ({ id: x, name: find(x)!.name })) };
  });
}

/** Mark the answers: each one is right when the picked drink's recipe is the one in the question */
export function gradeQuiz(staffId: number, answers: { key: string; choice: string }[]) {
  const recipes = allRecipes();
  const list = answers.slice(0, QUIZ_LENGTH);
  const right = list.map((a) => !!recipes[a.choice] && hash(recipes[a.choice]) === a.key);
  const score = right.filter(Boolean).length;
  if (staffId) db.prepare("INSERT INTO quiz_results (staff_id, score, out_of) VALUES (?, ?, ?)").run(staffId, score, list.length);
  return { score, outOf: list.length, passed: score >= QUIZ_PASS, right };
}
