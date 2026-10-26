"use client";
import "./page.css";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { photo, itemName } from "@/lib/menu";
import { defaultOptions } from "@/lib/pricing";

type Item = { id: string; name: string; price: number; img: string; soldOut: boolean; tried: string | null; times: number };
type Cat = { id: string; label: string; icon: string; items: Item[]; tried: number; total: number };
type Data = { cats: Cat[]; tried: number; total: number; next: Item | null };
const nice = (d: string) => new Date(`${d}T12:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function MenuExplorer() {
  const { menu, lang, add, toast } = useStore();
  const [d, setD] = useState<Data | null>(null);
  const [out, setOut] = useState(false);
  const [show, setShow] = useState<"all" | "left">("all");
  useEffect(() => { fetch("/api/account/explorer").then(async (r) => { if (r.status === 401) return setOut(true); setD(await r.json()); }).catch(() => {}); }, []);
  const order = (id: string) => {
    const m = menu.find((x) => x.id === id);
    if (!m) return toast("That one isn't on today's menu.");
    add(m.id, defaultOptions(m), 1); toast(`${itemName(m, lang)} added. Something new ✨`);
  };
  if (out) return (
    <div className="page narrow center">
      <span style={{ fontSize: "3rem" }}>🗺</span>
      <h1 className="h2">Menu <em>explorer</em></h1>
      <p className="lead">See every dish you&apos;ve tried at Moss &amp; Moon, and what&apos;s still waiting for you. It fills in from your orders when you&apos;re signed in.</p>
      <Link className="btn btn-pink" href="/account">Sign in to start exploring</Link>
    </div>
  );
  if (!d) return <div className="page"><p className="muted">Looking back through your orders…</p></div>;
  const pct = d.total ? Math.round((d.tried / d.total) * 100) : 0;
  return (
    <div className="page" style={{ maxWidth: "56rem" }}>
      <p className="eyebrow">your menu, mapped</p>
      <h1 className="h2">Menu <em>explorer</em></h1>
      <section className="card explore-hero">
        <div>
          <b className="explore-big">{d.tried} <span className="muted">of {d.total}</span></b>
          <span className="small muted">dishes tried · {pct}%</span>
        </div>
        <div className="explore-bar" role="progressbar" aria-valuemin={0} aria-valuemax={d.total} aria-valuenow={d.tried} aria-label="Dishes tried"><span style={{ width: `${pct}%` }} /></div>
        {d.next && <p className="small" style={{ margin: 0 }}>Try something new: <b>{d.next.name}</b> · ₹{d.next.price} <button className="link-btn small" onClick={() => order(d.next!.id)}>Add it →</button></p>}
      </section>
      <div className="explore-medals" aria-label="Categories">
        {d.cats.map((c) => (
          <a key={c.id} href={`#cat-${c.id}`} className={`explore-medal ${c.tried === c.total ? "done" : ""}`}>
            <span aria-hidden="true">{c.icon}</span><b>{c.label}</b><span className="tiny">{c.tried === c.total ? "🏅 all tried!" : `${c.tried}/${c.total}`}</span>
          </a>
        ))}
      </div>
      <div className="row" style={{ gap: "0.4rem", margin: "1rem 0 0" }}>
        <button className={`chip ${show === "all" ? "on" : ""}`} aria-pressed={show === "all"} onClick={() => setShow("all")}>Everything</button>
        <button className={`chip ${show === "left" ? "on" : ""}`} aria-pressed={show === "left"} onClick={() => setShow("left")}>Still to try</button>
      </div>
      {d.cats.map((c) => {
        const items = show === "left" ? c.items.filter((i) => !i.tried) : c.items;
        return (
          <section key={c.id} id={`cat-${c.id}`} style={{ marginTop: "1.4rem" }}>
            <h2 className="h3">{c.icon} {c.label} <span className="muted small">· {c.tried}/{c.total}</span></h2>
            {items.length ? (
              <ul className="explore-grid">
                {items.map((i) => (
                  <li key={i.id} className={`explore-item ${i.tried ? "tried" : ""}`}>
                    <span className="explore-photo"><Image src={photo(i.img, 200)} alt="" fill sizes="80px" style={{ objectFit: "cover" }} />{i.tried && <span className="explore-tick" aria-hidden="true">✓</span>}</span>
                    <span className="explore-text">
                      <b className="small">{i.name}</b>
                      {i.tried ? <span className="tiny muted">First tried {nice(i.tried)}{i.times > 1 ? ` · ${i.times} times` : ""}</span>
                        : i.soldOut ? <span className="tiny muted">Not today</span>
                        : <button className="link-btn tiny" onClick={() => order(i.id)}>Try it · ₹{i.price}</button>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">🏅 You&apos;ve tried everything here.</p>}
          </section>
        );
      })}
      <p className="tiny muted" style={{ marginTop: "1.2rem" }}>Counts orders made while signed in. Seasonal dishes come and go, so the total changes too.</p>
    </div>
  );
}
