"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import { TROPHIES, earned, type TrophyCtx } from "@/lib/trophies";
import { localTrophyStats } from "@/lib/trophyFlags";

const SEEN = "mm-trophies-seen";

export default function Trophies() {
  const [got, setGot] = useState<string[] | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    fetch(`/api/trophies?voter=${voterId()}`).then((r) => r.json()).then((d: Omit<TrophyCtx, "local">) => {
      const ids = earned({ ...d, local: localTrophyStats() });
      let seen: string[] = [];
      try { seen = JSON.parse(localStorage.getItem(SEEN) ?? "[]"); localStorage.setItem(SEEN, JSON.stringify(ids)); } catch {}
      setFresh(Array.isArray(seen) ? ids.filter((id) => !seen.includes(id)) : []);
      setGot(ids);
    }).catch(() => setGot([]));
  }, []);
  if (!got) return <div className="page"><p className="muted">Dusting the shelf…</p></div>;
  const groups = [...new Set(TROPHIES.map((t) => t.group))];
  return (
    <div className="page" style={{ maxWidth: "52rem" }}>
      <p className="eyebrow">games corner</p>
      <h1 className="h2">Trophy <em>shelf</em></h1>
      <p className="lead">{got.length} of {TROPHIES.length} trophies earned{got.length === TROPHIES.length ? ". Every single one! 🏆" : "."}</p>
      <div className="explore-bar" role="progressbar" aria-valuemin={0} aria-valuemax={TROPHIES.length} aria-valuenow={got.length} aria-label="Trophies earned"><span style={{ width: `${(got.length / TROPHIES.length) * 100}%` }} /></div>
      {groups.map((g) => (
        <section key={g} style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">{g}</h2>
          <ul className="trophy-grid">
            {TROPHIES.filter((t) => t.group === g).map((t) => {
              const has = got.includes(t.id);
              return (
                <li key={t.id} className={`card trophy ${has ? "has" : ""}`} aria-label={`${t.name}: ${has ? "earned" : "not yet"}. ${t.how}.`}>
                  <span className="trophy-emoji" aria-hidden="true">{has ? t.emoji : "🔒"}</span>
                  <b>{t.name}{fresh.includes(t.id) && <span className="trophy-new">New!</span>}</b>
                  <span className="tiny muted">{t.how}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="tiny muted" style={{ marginTop: "1.4rem" }}>Trophies are worked out from the games you&apos;ve played in this browser (and on your account, for the games that follow it). Wins against the computer are kept on this device. <Link href="/games">Back to the games corner</Link></p>
    </div>
  );
}
