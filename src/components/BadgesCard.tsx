"use client";
import { useEffect, useState } from "react";
import type { Badge } from "@/lib/badges";

/** Signed-in guests: streak and badges on the account page */
export default function BadgesCard() {
  const [d, setD] = useState<{ badges: Badge[]; streak: { current: number; best: number } } | null>(null);
  useEffect(() => {
    fetch("/api/account/badges").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
  }, []);
  if (!d) return null;
  const earned = d.badges.filter((b) => b.earned).length;
  return (
    <div className="card account-card" style={{ marginTop: "1.2rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3>🏅 Badges <span className="small muted">{earned} of {d.badges.length}</span></h3>
        <span className={`streak ${d.streak.current ? "on" : ""}`}>
          {d.streak.current ? `🔥 ${d.streak.current}-day streak` : "No streak right now"}
          {d.streak.best > 1 ? <span className="muted"> · best {d.streak.best}</span> : null}
        </span>
      </div>
      <ul className="badges">
        {d.badges.map((b) => (
          <li key={b.id} className={`badge-tile ${b.earned ? "earned" : ""}`} title={b.desc}>
            <span className="badge-icon" aria-hidden>{b.icon}</span>
            <b>{b.name}</b>
            <span className="small muted">{b.earned ? b.desc : b.progress ? `${b.progress.have} of ${b.progress.need} · ${b.desc}` : b.desc}</span>
            {!b.earned && b.progress && (
              <span className="badge-meter" role="meter" aria-valuenow={b.progress.have} aria-valuemin={0} aria-valuemax={b.progress.need} aria-label={`${b.name} progress`}>
                <span style={{ width: `${(b.progress.have / b.progress.need) * 100}%` }} />
              </span>
            )}
            <span className="sr-only">{b.earned ? "Earned" : "Not earned yet"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
