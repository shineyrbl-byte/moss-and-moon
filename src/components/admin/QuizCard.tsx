"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import type { QuizView } from "@/app/quiz/useQuiz";

/** Notices tab: host a live quiz night */
export function QuizCard() {
  const { toast } = useStore();
  const [quiz, setQuiz] = useState<QuizView | null | undefined>(undefined);
  const [title, setTitle] = useState("Quiz night");
  const [size, setSize] = useState(10);
  const [now, setNow] = useState(Date.now());
  const load = () => fetch("/api/quiz?host=1").then((r) => r.json()).then((d) => setQuiz(d.quiz)).catch(() => {});
  const live = !!quiz && quiz.phase !== "done";
  useEffect(() => { load(); const a = setInterval(load, live ? 2000 : 15000), b = setInterval(() => setNow(Date.now()), 500); return () => { clearInterval(a); clearInterval(b); }; }, [live]);
  async function host(body: Record<string, unknown>) {
    const r = await fetch("/api/quiz", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setQuiz(d.quiz);
  }
  if (quiz === undefined) return null;
  const q = quiz?.question, left = quiz?.endsAt ? Math.max(0, Math.ceil((quiz.endsAt - now) / 1000)) : 0;
  const nextLabel = !quiz ? "" : quiz.phase === "lobby" ? "Start the first question" : quiz.phase === "question" && left > 0 ? "Close this question now" : quiz.index + 1 >= quiz.total ? "Show the final scores" : "Next question";
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🎤 Quiz night {live && <span className="branch-tag">on now</span>}</h3>
      <p className="small muted" style={{ margin: 0 }}>Put <a href="/quiz/screen" target="_blank" rel="noreferrer">/quiz/screen</a> on the TV. Guests join at <a href="/quiz" target="_blank" rel="noreferrer">/quiz</a>. Questions come from the daily trivia set, and each one is open for 20 seconds.</p>
      {!live ? (
        <div className="row" style={{ alignItems: "end", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
          <label className="field" style={{ flex: "1 1 12rem", marginBottom: 0 }}>Title<input className="input" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="field" style={{ marginBottom: 0 }}>Questions<select className="input" value={size} onChange={(e) => setSize(Number(e.target.value))}>{[5, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <button className="btn btn-pink btn-sm" onClick={() => host({ action: "start", title, size })}>Open the quiz</button>
        </div>
      ) : (
        <div style={{ marginTop: "0.6rem" }}>
          <p className="small" style={{ margin: 0 }}>
            <b>{quiz!.title}</b> · {quiz!.players} team{quiz!.players === 1 ? "" : "s"}
            {quiz!.phase === "lobby" ? " · waiting to start" : ` · question ${quiz!.index + 1} of ${quiz!.total}`}
            {quiz!.phase === "question" && left > 0 && ` · ${left}s left · ${quiz!.answered} answered`}
          </p>
          {q && <p className="small" style={{ margin: "0.4rem 0" }}>&ldquo;{q.q}&rdquo; <span className="muted">Answer: {q.answer !== null ? q.choices[q.answer] : "?"}</span></p>}
          <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            <button className="btn btn-pink btn-sm" onClick={() => host({ action: "next" })}>{nextLabel}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => host({ action: "end" })}>End the quiz</button>
          </div>
          {quiz!.top.length > 0 && <p className="tiny muted" style={{ marginBottom: 0 }}>Top: {quiz!.top.slice(0, 3).map((t) => `${t.name} (${t.score})`).join(" · ")}</p>}
        </div>
      )}
      {quiz?.phase === "done" && <p className="tiny muted" style={{ marginBottom: 0 }}>Last quiz winner: {quiz.top[0]?.name ?? "nobody played"}.</p>}
    </section>
  );
}
