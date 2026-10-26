"use client";
import { isPast } from "@/lib/archive";

/** Shown on a daily puzzle when it's a past day from the archive */
export default function ArchiveNote({ date, path }: { date: string; path: string }) {
  if (!isPast(date)) return null;
  const nice = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <p className="archive-note small" role="note">
      📅 You&apos;re playing <b>{nice}</b> from the archive. It won&apos;t go on the board.{" "}
      {/* A full page load, so the puzzle starts fresh on today's date */}
      <a href={path}>Back to today</a> · <a href="/puzzle-archive">More days</a>
    </p>
  );
}
