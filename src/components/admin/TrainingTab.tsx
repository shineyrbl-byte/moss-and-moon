"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";

type Station = { id: string; label: string };
type Person = { id: number; name: string; role: string; stations: Record<string, { by: string | null; at: string }>; quiz: { best: number; tries: number; last: string } | null };
type Q = { key: string; steps: string[]; options: { id: string; name: string }[] };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Who's trained on which station (the owner signs people off), plus a recipe quiz for everyone */
export default function TrainingTab({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [d, setD] = useState<{ stations: Station[]; team: Person[]; me: number } | null>(null);
  const [quiz, setQuiz] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; outOf: number; passed: boolean; right: boolean[] } | null>(null);
  const load = useCallback(() => fetch("/api/admin/training").then((r) => r.json()).then(setD).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <p className="muted">Loading…</p>;

  async function toggle(p: Person, s: Station) {
    const r = await fetch("/api/admin/training", json("PUT", { staffId: p.id, station: s.id, trained: !p.stations[s.id] }));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    setD({ ...d!, team: x.team });
  }
  async function start() {
    setResult(null);
    setAnswers({});
    const r = await fetch("/api/admin/training/quiz");
    setQuiz((await r.json()).questions);
  }
  async function submit() {
    const r = await fetch("/api/admin/training/quiz", json("POST", { answers: quiz!.map((q) => ({ key: q.key, choice: answers[q.key] ?? "" })) }));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    setResult(x);
    load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
        <h3 style={{ fontSize: "1.3rem" }}>🎓 Training</h3>
        <p className="small muted">{canEdit ? "Tap a box to sign someone off once they can do that station on their own." : "The owner signs you off on each station once you can do it on your own."}</p>
        {!d.team.length ? <p className="muted">Add people in the Team tab first.</p> : (
          <div className="rota-wrap">
            <table className="rota training">
              <thead><tr><th scope="col">Name</th>{d.stations.map((s) => <th key={s.id} scope="col">{s.label}</th>)}<th scope="col">Quiz best</th></tr></thead>
              <tbody>
                {d.team.map((p) => {
                  const n = Object.keys(p.stations).length;
                  return (
                    <tr key={p.id} className={p.id === d.me ? "me" : ""}>
                      <th scope="row">{p.name}<br /><small className="muted">{n}/{d.stations.length}</small></th>
                      {d.stations.map((s) => {
                        const on = p.stations[s.id];
                        return (
                          <td key={s.id}>
                            {canEdit
                              ? <button className={`train-box ${on ? "on" : ""}`} onClick={() => toggle(p, s)} aria-pressed={!!on} aria-label={`${p.name}: ${s.label}`} title={on ? `Signed off by ${on.by} on ${on.at}` : "Not yet"}>{on ? "✓" : ""}</button>
                              : <span className={`train-box ${on ? "on" : ""}`} title={on ? `Signed off ${on.at}` : "Not yet"}>{on ? "✓" : ""}</span>}
                          </td>
                        );
                      })}
                      <td className="small">{p.quiz ? `${p.quiz.best}/5` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
        <div className="sum-row" style={{ alignItems: "center" }}>
          <h3 style={{ fontSize: "1.3rem" }}>📖 Recipe quiz</h3>
          <button className="btn btn-ghost btn-sm" onClick={start}>{quiz ? "New quiz" : "Start the quiz"}</button>
        </div>
        <p className="small muted">Five recipes from the recipe cards: which drink is it? Get 4 right to pass.</p>
        {quiz?.map((q, i) => (
          <fieldset key={q.key} className={`quiz-q ${result ? (result.right[i] ? "right" : "wrong") : ""}`}>
            <legend className="small"><b>{i + 1}.</b> Which drink is this?</legend>
            <ol className="recipe-steps small">{q.steps.map((st, j) => <li key={j}>{st}</li>)}</ol>
            <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label={`Question ${i + 1}`}>
              {q.options.map((o) => <button key={o.id} type="button" role="radio" aria-checked={answers[q.key] === o.id} disabled={!!result} className={`chip ${answers[q.key] === o.id ? "on" : ""}`} onClick={() => setAnswers({ ...answers, [q.key]: o.id })}>{o.name}</button>)}
            </div>
          </fieldset>
        ))}
        {quiz && !result && <button className="btn btn-pink btn-sm" disabled={Object.keys(answers).length < quiz.length} onClick={submit}>Hand it in</button>}
        {result && <p className={result.passed ? "success" : "cashup-bad"}><b>{result.score}/{result.outOf}</b> {result.passed ? "Passed! 🎉" : "Not quite. Read the recipe cards and try again."}</p>}
      </section>
    </div>
  );
}
