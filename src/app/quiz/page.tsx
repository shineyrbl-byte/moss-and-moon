"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { LETTERS, secsLeft, useQuiz } from "./useQuiz";

export default function QuizPage() {
  const { toast } = useStore();
  const [voter, setVoter] = useState("");
  useEffect(() => setVoter(voterId()), []);
  const { quiz, setQuiz, now } = useQuiz(`voter=${voter}`);
  const [name, setName] = useState("");
  useEffect(() => { try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  async function send(body: Record<string, unknown>) {
    const r = await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, voter }) });
    const d = await r.json();
    if (!r.ok) { toast(d.error); return false; }
    setQuiz(d.quiz); return true;
  }
  async function join() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    if (await send({ action: "join", name })) toast("You're in! 🎤");
  }
  if (!voter || quiz === undefined) return <div className="page"><p className="muted">Tuning the mic…</p></div>;
  if (!quiz) return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">live at the café</p>
      <h1 className="h2">Quiz <em>night</em></h1>
      <p>There&apos;s no quiz on right now. When the team starts one, the questions show on the TV and you answer here on your phone.</p>
      <p className="small muted">Fancy a question in the meantime? Try <Link href="/trivia">today&apos;s trivia</Link>.</p>
    </div>
  );
  const q = quiz.question, me = quiz.me, left = secsLeft(quiz.endsAt, now);
  const open = quiz.phase === "question" && left > 0;
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">live at the café</p>
      <h1 className="h2">{quiz.title}</h1>
      {me && <p className="quiz-me"><b>{me.name}</b> · {me.score.toLocaleString("en-IN")} points{me.rank ? ` · ${me.rank === 1 ? "🥇 1st" : `#${me.rank}`}` : ""}</p>}
      {!me && quiz.phase !== "done" && (
        <section className="card quiz-join">
          <label className="field">Your team name<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="The Flat Whites" /></label>
          <button className="btn btn-pink" onClick={join} disabled={!name.trim()}>Join the quiz</button>
          <p className="tiny muted" style={{ margin: 0 }}>{quiz.players} team{quiz.players === 1 ? "" : "s"} in so far.</p>
        </section>
      )}
      {quiz.phase === "lobby" && me && <p className="quiz-wait">You&apos;re in ✓<br /><span className="small muted">Waiting for the host to start. Keep an eye on the TV.</span></p>}
      {q && quiz.phase !== "lobby" && quiz.phase !== "done" && (
        <section className="quiz-q" aria-live="polite">
          <p className="small muted">Question {quiz.index + 1} of {quiz.total}{open ? <> · <b className={left <= 5 ? "quiz-hurry" : ""}>{left}s</b></> : " · closed"}</p>
          <h2 className="h3">{q.q}</h2>
          <div className="quiz-choices">
            {q.choices.map((c, i) => {
              const mine = me?.choice === i, right = q.answer === i;
              return (
                <button key={i} className={`quiz-choice ${mine ? "mine" : ""} ${q.answer !== null ? (right ? "right" : mine ? "wrong" : "") : ""}`}
                  disabled={!open || !me || me.choice !== null} onClick={() => send({ action: "answer", choice: i })} aria-pressed={mine}>
                  <span className="quiz-letter" aria-hidden="true">{LETTERS[i]}</span>{c}
                </button>
              );
            })}
          </div>
          {open && me?.choice !== null && me && <p className="small center">Locked in. Fingers crossed 🤞</p>}
          {!open && me && <p className="center"><b>{me.choice === null ? "No answer this time" : me.points ? `+${me.points} points 🎉` : "Not this one"}</b></p>}
          {!open && q.why && <p className="small muted">{q.why}</p>}
        </section>
      )}
      {(quiz.phase === "reveal" || quiz.phase === "done") && quiz.top.length > 0 && (
        <section style={{ marginTop: "1.2rem" }}>
          <h2 className="h3">{quiz.phase === "done" ? "Final scores 🏆" : "Leaderboard"}</h2>
          <ol className="memory-board">{quiz.top.map((t, i) => <li key={i} className={me?.name === t.name ? "on" : ""}><span>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{t.name}</span><b>{t.score.toLocaleString("en-IN")}</b></li>)}</ol>
        </section>
      )}
      {quiz.phase === "done" && <p className="small muted">Thanks for playing! {me?.rank === 1 ? "Show this screen at the counter for a well-earned round of applause 👏" : ""}</p>}
      <p className="tiny muted" style={{ marginTop: "1.2rem" }}>Right answers score 500 points, plus up to 500 more for answering quickly.</p>
    </div>
  );
}
