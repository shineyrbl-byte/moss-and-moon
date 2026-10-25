"use client";
import { useCallback, useEffect, useState } from "react";

export type QuizView = {
  id: number; title: string; phase: "lobby" | "question" | "reveal" | "done"; index: number; total: number; players: number;
  top: { name: string; score: number }[]; endsAt: number | null;
  question: { q: string; choices: string[]; answer: number | null; why: string | null } | null;
  answered: number; counts: number[] | null;
  me: { name: string; score: number; rank: number | null; choice: number | null; points: number | null } | null;
};

/** Keeps the quiz up to date: checks often while a question is open, less often between */
export function useQuiz(query: string) {
  const [quiz, setQuiz] = useState<QuizView | null | undefined>(undefined);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(() => fetch(`/api/quiz?${query}`).then((r) => r.json()).then((d) => setQuiz(d.quiz)).catch(() => {}), [query]);
  const fast = quiz?.phase === "question";
  useEffect(() => { load(); const id = setInterval(load, fast ? 1500 : 3000); return () => clearInterval(id); }, [load, fast]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);
  // Check straight away when the time's up
  const due = !!quiz?.endsAt && now >= quiz.endsAt + 300;
  useEffect(() => { if (due) load(); }, [due, load]);
  return { quiz, setQuiz, now, load };
}
export const secsLeft = (endsAt: number | null, now: number) => (endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0);
export const LETTERS = ["A", "B", "C", "D", "E"];
