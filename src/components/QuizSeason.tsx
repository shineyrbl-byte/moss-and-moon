"use client";
// This season's quiz night standings: points from every quiz this quarter, added up by team name
import { useEffect, useState } from "react";

type S = { season: string; quizzes: number; teams: { name: string; points: number; quizzes: number; wins: number }[] };

export default function QuizSeason() {
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { fetch("/api/quiz?season=1").then((r) => r.json()).then(setS).catch(() => {}); }, []);
  if (!s) return null;
  return (
    <section className="card" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }} aria-labelledby="qs-h">
      <h2 className="h3" id="qs-h" style={{ marginTop: 0 }}>🏆 Season standings <span className="small muted">· {s.season}</span></h2>
      {s.teams.length ? (
        <ol className="memory-board">{s.teams.map((t, k) => <li key={k}><span>{t.name}{t.wins ? ` · ${t.wins} win${t.wins === 1 ? "" : "s"}` : ""}</span><b>{t.points.toLocaleString("en-IN")}</b></li>)}</ol>
      ) : <p className="small muted">No quizzes finished yet this season. Play under the same team name each time and your points add up here.</p>}
      {s.teams.length > 0 && <p className="tiny muted" style={{ margin: "0.4rem 0 0" }}>{s.quizzes} quiz{s.quizzes === 1 ? "" : "zes"} so far this season. Use the same team name each night to keep adding up.</p>}
    </section>
  );
}
