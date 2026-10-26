"use client";
import { useEffect, useState } from "react";
import { isPast, isPractice, practiceDay, todayStr } from "@/lib/archive";
import ChallengeNote from "@/components/ChallengeNote";

/** Shown on a daily puzzle when it's a past day from the archive, or a practice puzzle; and a friend's challenge, if there is one */
export default function ArchiveNote({ date, path }: { date: string; path: string }) {
  const [practice, setPractice] = useState(false);
  useEffect(() => setPractice(isPractice()), [date]);
  if (!isPast(date)) return <ChallengeNote date={date} path={path} />;
  if (practice) {
    return (
      <p className="archive-note small" role="note">
        🎲 A <b>practice puzzle</b>: play as many as you like. They don&apos;t go on the boards or count for streaks.{" "}
        {/* Full page loads, so the next puzzle starts fresh */}
        <a href={`${path}?practice=1&day=${practiceDay(todayStr())}`}>Another one</a> · <a href={path}>Back to today</a> · <a href="/practice">All practice</a>
      </p>
    );
  }
  const nice = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <>
      <p className="archive-note small" role="note">
        📅 You&apos;re playing <b>{nice}</b> from the archive. It won&apos;t go on the board.{" "}
        <a href={path}>Back to today</a> · <a href="/puzzle-archive">More days</a>
      </p>
      <ChallengeNote date={date} path={path} />
    </>
  );
}
