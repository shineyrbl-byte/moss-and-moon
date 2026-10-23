"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { konkaniFor, quizFor, weekBefore } from "@/lib/konkani";
import { toDateStr } from "@/lib/cafe";

export default function Konkani() {
  const [date, setDate] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  useEffect(() => setDate(toDateStr(new Date())), []);
  if (!date) return <div className="page narrow" />;
  const w = konkaniFor(date);
  const sunday = new Date(`${date}T12:00`).getDay() === 0;
  const quiz = sunday ? quizFor(date) : [];
  const score = quiz.filter((q, i) => answers[i] === q.answer).length;
  const done = sunday && Object.keys(answers).length === quiz.length;
  const sinceMonday = new Date(`${date}T12:00`).getDay() - 1; // Monday = 0
  const earlier = sinceMonday > 0 ? weekBefore(date).slice(-sinceMonday) : [];
  return (
    <div className="page" style={{ maxWidth: "38rem" }}>
      <p className="eyebrow">{new Date(`${date}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1 className="h2">Konkani <em>word of the day</em></h1>
      <p className="lead">Goa&apos;s own language, one everyday word or phrase at a time. Try it on us at the counter.</p>
      <section className="card konkani-card" aria-live="polite">
        <p className="konkani-word" lang="gom-Latn">{w.word}</p>
        <p className="small muted" style={{ margin: 0 }}>say it: <i>{w.say}</i></p>
        <p className="konkani-means">{w.means}</p>
        {w.example && <p className="small konkani-eg"><b lang="gom-Latn">{w.example}</b><br /><span className="muted">{w.exampleMeans}</span></p>}
      </section>

      {sunday ? (
        <section className="card konkani-quiz">
          <h2 className="h3" style={{ marginTop: 0 }}>Sunday quiz: this week&apos;s words</h2>
          <ol>
            {quiz.map((q, i) => (
              <li key={i}>
                <b lang="gom-Latn">{q.word}</b>
                <div className="trivia-choices">
                  {q.choices.map((c, j) => {
                    const picked = answers[i];
                    const st = picked === undefined ? "" : j === q.answer ? "right" : j === picked ? "wrong" : "";
                    return <button key={j} className={`trivia-choice ${st}`} disabled={picked !== undefined} onClick={() => setAnswers({ ...answers, [i]: j })}>{c}</button>;
                  })}
                </div>
              </li>
            ))}
          </ol>
          {done && <p><b>{score} of {quiz.length}</b> {score === quiz.length ? "· ekdom borem! 🎉" : score >= 4 ? "· bhov borem!" : "· come back every day this week and try again next Sunday ✿"}</p>}
        </section>
      ) : (
        <section className="konkani-week">
          {earlier.length > 0 && <h2 className="h3">Earlier this week</h2>}
          <ul>
            {earlier.map((d) => { const x = konkaniFor(d); return <li key={d}><b lang="gom-Latn">{x.word}</b> <span className="muted">· {x.means}</span></li>; })}
          </ul>
          <p className="small muted">Every Sunday there&apos;s a quick quiz on the week&apos;s words.</p>
        </section>
      )}
      <p className="tiny muted" style={{ marginTop: "1.2rem" }}>Written in Romi (Roman script), as it&apos;s often written in Goa. Spellings change from village to village. Know a better way to say it? Tell us at the counter. Also try <Link href="/word">the café word</Link>.</p>
    </div>
  );
}
