"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, photo, type Category, type Diet } from "@/lib/menu";
import { HAPPY_HOUR, defaultOptions, isHappyHour, rupees } from "@/lib/pricing";
import { useStore } from "./Store";
import Reveal from "./Reveal";

export default function Menu() {
  const { menu, setCustomizing, add, toast, soldOut, favs, toggleFav, t } = useStore();
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [happy, setHappy] = useState(false);
  useEffect(() => setHappy(isHappyHour()), []);
  const [cat, setCat] = useState<Category | "all">("all");
  const [diet, setDiet] = useState<Diet[]>([]);
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return menu.filter(
      (m) =>
        (cat === "all" || m.cat === cat) &&
        (!onlyFavs || favs.has(m.id)) &&
        diet.every((d) => m.diet?.includes(d)) &&
        (!s || `${m.name} ${m.desc} ${m.badge ?? ""}`.toLowerCase().includes(s))
    );
  }, [menu, cat, diet, q, onlyFavs, favs]);

  const toggleDiet = (d: Diet) => setDiet((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  return (
    <Reveal id="menu" className="section">
      <div className="center">
        <p className="eyebrow">{t("menu.eyebrow")}</p>
        <h2>{t("menu.title1")} <em>{t("menu.title2")}</em></h2>
        <p className="lead">{t("menu.lead")}</p>
        <p className="happy-pill">{happy ? "✨ It's golden hour! " : "☀︎ "}{HAPPY_HOUR.label}</p>
      </div>

      <div className="menu-tools">
        <label className="search">
          <span aria-hidden>⌕</span>
          <span className="sr-only">Search the menu</span>
          <input className="input" placeholder={t("menu.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? "on" : ""}`} onClick={() => setCat(c.id)}>{t(`menu.${c.id}` as "menu.all")}</button>
          ))}
        </div>
        <div className="chips">
          <button className={`chip ${diet.includes("vegan") ? "on" : ""}`} onClick={() => toggleDiet("vegan")}>{t("menu.vegan")}</button>
          <button className={`chip ${diet.includes("gf") ? "on" : ""}`} onClick={() => toggleDiet("gf")}>{t("menu.gf")}</button>
          <button className={`chip ${onlyFavs ? "on" : ""}`} onClick={() => setOnlyFavs((v) => !v)}>{t("menu.favs")}{favs.size ? ` (${favs.size})` : ""}</button>
        </div>
      </div>

      <div className="menu-grid">
        {items.map((m, i) => {
          const out = soldOut.has(m.id);
          return (
            <article key={m.id} className="item card" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
              <button className="item-photo" style={{ border: "none", padding: 0 }} onClick={() => setCustomizing(m)} aria-label={`Customise ${m.name}`}>
                <Image src={photo(m.img, 700)} alt={m.name} fill sizes="(max-width: 600px) 90vw, 300px" />
                {m.badge && <span className={`item-badge ${m.badge === "pink pick" ? "pink" : ""}`}>{m.badge}</span>}
                {out && <span className="soldout">{t("menu.soldout")}</span>}
              </button>
              <button className={`fav ${favs.has(m.id) ? "on" : ""}`} onClick={() => toggleFav(m.id)} aria-pressed={favs.has(m.id)} aria-label={`Favourite ${m.name}`}>
                {favs.has(m.id) ? "♥" : "♡"}
              </button>
              <div className="item-body">
                <h3 style={{ cursor: "pointer" }} onClick={() => setCustomizing(m)}>{m.name}</h3>
                {happy && m.cat === "bakes" && <span className="small" style={{ color: "var(--pink-deep)" }}>golden hour −20%</span>}
                <p>{m.desc}</p>
                <div className="item-foot">
                  <div>
                    <span className="price">{rupees(m.price)}</span>
                    {m.diet && (
                      <div className="diet">
                        {m.diet.map((d) => <span key={d}>{d === "gf" ? "GF" : "vegan"}</span>)}
                      </div>
                    )}
                  </div>
                  <button
                    className="add"
                    disabled={out}
                    aria-label={`Add ${m.name}`}
                    onClick={() => {
                      add(m.id, defaultOptions(m));
                      toast(`${m.name} added ✿`);
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!items.length && <p className="empty-state">{onlyFavs && !favs.size ? "Tap the ♡ on anything you love and it'll live here." : t("menu.empty")}</p>}
    </Reveal>
  );
}
