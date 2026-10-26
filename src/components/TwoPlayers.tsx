"use client";
/** The "two players" switch on the board games: turns the computer off so two people can take turns on one device */
export default function TwoPlayers({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onChange(!on)} title="Pass the device between two people">
      👥 Two players
    </button>
  );
}
/** What to call each side */
export const sides = (two: boolean) => (two ? ["Player 1", "Player 2"] : ["You", "Computer"]);
