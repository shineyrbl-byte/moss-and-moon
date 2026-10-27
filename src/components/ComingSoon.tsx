"use client";
// The owner's "coming soon" countdown on the home page (nothing shows until they set one)
import { useEffect, useState } from "react";

export default function ComingSoon() {
  const [c, setC] = useState<{ title: string; date: string; blurb: string; days: number } | null>(null);
  useEffect(() => { fetch("/api/coming-soon").then((r) => r.json()).then((d) => setC(d.soon)).catch(() => {}); }, []);
  if (!c) return null;
  return (
    <section className="coming-soon" aria-label="Coming soon">
      <span className="coming-days"><b>{c.days === 0 ? "Today!" : c.days}</b>{c.days > 0 && <small>{c.days === 1 ? "day" : "days"}</small>}</span>
      <span><span className="tiny">COMING SOON</span><b>{c.title}</b>{c.blurb && <span className="small">{c.blurb}</span>}</span>
    </section>
  );
}
