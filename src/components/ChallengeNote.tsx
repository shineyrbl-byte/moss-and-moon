"use client";
import { useEffect, useState } from "react";
import { CHALLENGE_PARAM, challengeKey, decodeChallenge, encodeChallenge, type Challenge } from "@/lib/challenge";
import { pastDays, todayStr } from "@/lib/archive";

/** The challenge a friend sent for this puzzle, from the link (kept so a refresh doesn't lose it) */
export function readChallenge(path: string): Challenge | null {
  try {
    const fromLink = decodeChallenge(new URLSearchParams(window.location.search).get(CHALLENGE_PARAM));
    if (fromLink) { localStorage.setItem(challengeKey(path), JSON.stringify(fromLink)); return fromLink; }
    const kept = JSON.parse(localStorage.getItem(challengeKey(path)) ?? "null") as Challenge | null;
    return kept ? decodeChallenge(encodeChallenge(kept)) : null;
  } catch { return null; }
}
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** "Leela challenged you": shown at the top of the puzzle the link was for */
export default function ChallengeNote({ date, path }: { date: string; path: string }) {
  const [c, setC] = useState<Challenge | null>(null);
  useEffect(() => { if (date) setC(readChallenge(path)); }, [date, path]);
  if (!c || !date) return null;
  if (c.d !== date) {
    // The link was for a day that's no longer in the archive (or the address lost its ?day=)
    const today = todayStr(), stillThere = c.d === today || pastDays(today).includes(c.d);
    if (stillThere) return <p className="archive-note small" role="note">🤝 {c.n}&apos;s challenge is for {nice(c.d)}. <a href={`${path}${c.d === today ? "" : `?day=${c.d}`}`}>Play that one</a></p>;
    return null;
  }
  return (
    <p className="archive-note challenge-note small" role="note">
      🤝 <b>{c.n}</b> challenged you{c.m ? ` (on ${c.m})` : ""}: &ldquo;{c.h}&rdquo;. Finish to see who wins.
    </p>
  );
}
