"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { moonNow } from "@/lib/moon";
import { readCup } from "@/lib/fortune";
import { defaultOptions } from "@/lib/pricing";
import { itemName } from "@/lib/menu";
import { toDateStr } from "@/lib/cafe";

type Reading = ReturnType<typeof readCup> & { date: string; phase: ReturnType<typeof moonNow>["phase"] };

export default function Fortune() {
  const { menu, lang, add, toast, setDrawerOpen } = useStore();
  const [r, setR] = useState<Reading | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const date = toDateStr(new Date());
    const m = moonNow();
    setR({ ...readCup(date, voterId() || "guest", m.phase.id), date, phase: m.phase });
    try { setShown(sessionStorage.getItem("mm-cup") === date); } catch {}
  }, []);
  const drinks = useMemo(() => menu.filter((m) => ["coffee", "tea", "cold"].includes(m.cat) && !m.pup && !m.soldOut && !m.groups?.length).sort((a, b) => a.id.localeCompare(b.id)), [menu]);
  if (!r) return <div className="page narrow" />;
  const lucky = drinks.length ? drinks[Math.floor(r.lucky * drinks.length)] : undefined;
  const reveal = () => { setShown(true); try { sessionStorage.setItem("mm-cup", r.date); } catch {} };
  const share = async () => {
    const text = `🔮 My cup today at Moss & Moon: I saw ${r.symbol.name} ${r.symbol.icon} (${r.symbol.meaning}). "${r.text}"`;
    try { if (navigator.share) await navigator.share({ text, url: location.href }); else { await navigator.clipboard.writeText(`${text} ${location.href}`); toast("Copied ✿"); } } catch {}
  };
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">{r.phase.icon} {r.phase.label} · just for fun</p>
      <h1 className="h2">Read your <em>cup</em></h1>
      <p className="lead">An old café game: swirl the last of your coffee, tip the cup, and see what shape the grounds leave. A new reading every day.</p>
      <section className={`card cup-read ${shown ? "shown" : ""}`} aria-live="polite">
        <div className="cup-art" aria-hidden="true">
          <span className="cup-symbol">{shown ? r.symbol.icon : "☕"}</span>
        </div>
        {!shown ? (
          <button className="btn btn-pink" onClick={reveal}>Swirl and tip the cup</button>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>In the grounds you see…</p>
            <h2 className="h3" style={{ margin: "0.2rem 0" }}>{r.symbol.name}: {r.symbol.meaning}</h2>
            <p className="cup-text">&ldquo;{r.text}&rdquo;</p>
            <p className="small">Lucky number <b>{r.luckyNumber}</b>{lucky && <> · lucky drink <b>{itemName(lucky, lang)}</b></>}</p>
            <div className="row" style={{ gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
              {lucky && <button className="btn btn-pink btn-sm" onClick={() => { add(lucky.id, defaultOptions(lucky), 1); toast(`${itemName(lucky, lang)} added 🔮`); setDrawerOpen(true); }}>Order my lucky drink</button>}
              <button className="btn btn-ghost btn-sm" onClick={share}>Share</button>
            </div>
          </>
        )}
      </section>
      <p className="small muted center" style={{ marginTop: "1rem" }}>Readings change with the moon. Come back tomorrow, or <Link href="/trivia">try today&apos;s trivia</Link>.</p>
    </div>
  );
}
