"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { foundKeys } from "@/components/HuntToken";
import { todayStr } from "@/lib/archive";
import { HUNT_SIZE, huntFor, nextHunt, type Spot } from "@/lib/puzzleHunt";

export default function PuzzleHunt() {
  const [h, setH] = useState<{ key: string; spots: Spot[]; found: string[] } | null | undefined>(undefined);
  const [shown, setShown] = useState<string[]>([]);
  useEffect(() => { const x = huntFor(todayStr()); setH(x ? { ...x, found: foundKeys(x.key) } : null); }, []);
  if (h === undefined) return <div className="page"><p className="muted">Hiding the keys…</p></div>;
  const n = h ? h.spots.filter((s) => h.found.includes(s.path)).length : 0;
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">every weekend</p>
      <h1 className="h2">Puzzle <em>hunt</em></h1>
      <p className="small muted">Every Saturday and Sunday, five pages around the site hide a little 🗝️ key in the bottom corner. Each riddle below points to one page. Find all five before Sunday ends for a trophy. Your keys are kept in this browser.</p>
      {!h ? (
        <p className="card">No hunt today. The next one starts on Saturday {new Date(`${nextHunt(todayStr())}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.</p>
      ) : (
        <>
          <p className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{n}</b>/{HUNT_SIZE} keys</span></p>
          {n >= HUNT_SIZE && <p className="card center">🎉 You found every key this weekend! The Treasure hunter trophy is on your <Link href="/trophies">shelf</Link>.</p>}
          <ol className="hunt-list" style={{ listStyle: "none", padding: 0 }}>
            {h.spots.map((s, k) => {
              const got = h.found.includes(s.path);
              return (
                <li key={s.path} className="card" style={{ marginBottom: "0.6rem" }}>
                  <b>{got ? "🗝️" : "❓"} Riddle {k + 1}</b>
                  <p style={{ margin: "0.3rem 0" }}>{s.riddle}</p>
                  {got ? <span className="tiny">Found on <Link href={s.path}>{s.path}</Link></span>
                    : shown.includes(s.path) ? <span className="tiny">It&apos;s on <Link href={s.path}>{s.path}</Link></span>
                    : <button className="link-btn tiny" onClick={() => setShown([...shown, s.path])}>Stuck? Show me the page</button>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
