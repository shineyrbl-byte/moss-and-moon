"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NEWS, SEEN_KEY } from "@/lib/whatsNew";

export default function WhatsNew() {
  // Things added since your last look get a "new" tag
  const [seen, setSeen] = useState<string | null>(null);
  useEffect(() => {
    try { setSeen(localStorage.getItem(SEEN_KEY) ?? ""); localStorage.setItem(SEEN_KEY, NEWS[0].date); } catch { setSeen(""); }
  }, []);
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">what&apos;s new</p>
      <h1 className="h2">Fresh <em>off the counter</em></h1>
      <p className="small muted">The latest things to try on the site, newest first.</p>
      {NEWS.map((n, k) => (
        <section key={k} className="card" style={{ padding: "0.9rem 1.1rem", marginBottom: "0.8rem" }}>
          <p className="tiny muted" style={{ margin: 0 }}>{fmt(n.date)}{seen !== null && seen !== "" && n.date > seen && <b className="chip on" style={{ marginLeft: "0.4rem", padding: "0 0.5rem" }}>new</b>}</p>
          <h2 className="h3" style={{ margin: "0.1rem 0 0.4rem" }}>{n.title}</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {n.items.map((x, j) => <li key={j} style={{ marginBottom: "0.2rem" }}>{x.href ? <Link href={x.href}>{x.text}</Link> : x.text}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
