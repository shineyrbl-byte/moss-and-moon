"use client";
import "./page.css";
import { LETTERS, secsLeft, useQuiz } from "../useQuiz";

// The TV view: open /quiz/screen on the café screen and go full screen.
export default function QuizScreen() {
  const { quiz, now } = useQuiz("");
  if (quiz === undefined) return null;
  if (!quiz) return <div className="quiz-tv"><h1>Quiz night 🎤</h1><p className="muted">Waiting for the host to start a quiz…</p></div>;
  const q = quiz.question, left = secsLeft(quiz.endsAt, now), open = quiz.phase === "question" && left > 0;
  const most = Math.max(1, ...(quiz.counts ?? [1]));
  return (
    <div className="quiz-tv">
      <header><span>🎤 {quiz.title}</span>{q && quiz.phase !== "done" && <span>Question {quiz.index + 1}/{quiz.total}</span>}</header>
      {quiz.phase === "lobby" && (
        <div className="quiz-tv-lobby">
          <h1>Join the quiz!</h1>
          <p>On your phone: <b>mossandmoon → Quiz night</b></p>
          <p className="quiz-tv-big">{quiz.players} team{quiz.players === 1 ? "" : "s"} in</p>
          <p className="muted">{quiz.top.map((t) => t.name).join(" · ")}</p>
        </div>
      )}
      {q && (quiz.phase === "question" || quiz.phase === "reveal") && (
        <>
          <h1 className="quiz-tv-q">{q.q}</h1>
          <div className="quiz-tv-choices">
            {q.choices.map((c, i) => (
              <div key={i} className={`quiz-tv-choice ${!open && q.answer === i ? "right" : ""} ${!open && q.answer !== i ? "dim" : ""}`}>
                <span className="quiz-letter">{LETTERS[i]}</span><span>{c}</span>
                {!open && quiz.counts && <span className="quiz-tv-bar" style={{ width: `${(quiz.counts[i] / most) * 100}%` }} aria-label={`${quiz.counts[i]} teams`}><b>{quiz.counts[i]}</b></span>}
              </div>
            ))}
          </div>
          {open ? <p className={`quiz-tv-time ${left <= 5 ? "quiz-hurry" : ""}`}>{left}s · {quiz.answered}/{quiz.players} answered</p> : q.why && <p className="quiz-tv-why">{q.why}</p>}
        </>
      )}
      {(quiz.phase === "reveal" || quiz.phase === "done") && quiz.top.length > 0 && (
        <ol className="quiz-tv-top">
          {quiz.top.slice(0, quiz.phase === "done" ? 10 : 3).map((t, i) => <li key={i}><span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {t.name}</span><b>{t.score.toLocaleString("en-IN")}</b></li>)}
        </ol>
      )}
      {quiz.phase === "done" && <p className="quiz-tv-big">Well played, everyone! 👏</p>}
    </div>
  );
}
