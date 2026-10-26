"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { rupees } from "@/lib/pricing";

type Door = { day: number; date: string; open: boolean; live: boolean; past: boolean; code?: string; title?: string; pair?: string; min?: number };
type A = { year: number; today: string; started: boolean; finished: boolean; preview: boolean; doors: Door[] };
// A jumbled order so the doors look like a real calendar
const ORDER = [7, 15, 2, 21, 11, 4, 18, 9, 24, 13, 1, 20, 6, 16, 10, 23, 3, 12, 19, 8, 14, 22, 5, 17];

export default function Advent() {
  const { toast } = useStore();
  const [a, setA] = useState<A | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(location.search).get("preview") === "1";
    setPreview(p);
    fetch(`/api/advent${p ? "?preview=1" : ""}`).then((r) => r.json()).then(setA).catch(() => {});
    try { setFlipped(new Set(JSON.parse(localStorage.getItem("mm-advent") ?? "[]"))); } catch {}
  }, []);
  function openDoor(d: Door) {
    if (!d.open) return toast(`Door ${d.day} opens on ${d.day} December ✿`);
    const next = new Set(flipped).add(d.day);
    setFlipped(next);
    try { localStorage.setItem("mm-advent", JSON.stringify([...next])); } catch {}
  }
  async function copy(code: string) { try { await navigator.clipboard.writeText(code); toast(`${code} copied. Use it at checkout today ✿`); } catch {} }
  if (!a) return <div className="page narrow"><p className="muted">Lighting the candles…</p></div>;
  const byDay = new Map(a.doors.map((d) => [d.day, d]));
  return (
    <div className="page" style={{ maxWidth: "60rem" }}>
      <p className="eyebrow">december {a.year}</p>
      <h1 className="h2">Advent <em>calendar</em></h1>
      <p className="lead">
        {a.preview ? "Owner preview: every door is open so you can check them." : !a.started ? `A door a day from 1 to 24 December, each with a little treat. Come back on the 1st!` : a.finished ? "That's all 24 doors for this year. Merry Christmas from all of us 🎄" : "Open today's door for a one-day treat. Use the code at checkout before midnight."}
      </p>
      {preview && !a.preview && <p className="small muted">Previews are for the owner. <Link href="/admin">Sign in as the owner</Link> first.</p>}
      <div className="advent-grid">
        {ORDER.map((day) => {
          const d = byDay.get(day)!;
          const shown = d.open && (flipped.has(day) || a.preview);
          return (
            <div key={day} className={`advent-door ${d.open ? "can" : "locked"} ${shown ? "flipped" : ""} ${d.live ? "live" : ""}`}>
              {!shown ? (
                <button onClick={() => openDoor(d)} aria-label={d.open ? `Open door ${day}` : `Door ${day}, opens ${day} December`}>
                  <span className="advent-num">{day}</span>
                  {!d.open && <span aria-hidden>🔒</span>}
                  {d.live && <span className="tiny">today!</span>}
                </button>
              ) : (
                <div className="advent-inside">
                  <span className="tiny muted">Door {day}</span>
                  <b className="small">{d.title}</b>
                  {d.min ? <span className="tiny muted">on orders over {rupees(d.min)}</span> : null}
                  {d.past && !a.preview ? <span className="tiny muted">Ended</span> : <button className="chip on" onClick={() => copy(d.code!)}>{d.code}</button>}
                  <span className="tiny">Try: {d.pair}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="small muted">One use per guest. Each code only works on its own day.</p>
    </div>
  );
}
