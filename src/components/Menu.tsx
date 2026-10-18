"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_ORDER, inTab, photo, type Diet, type MenuTab } from "@/lib/menu";
import { HAPPY_HOUR, defaultOptions, isHappyHour, rupees } from "@/lib/pricing";
import { useStore } from "./Store";
import Reveal from "./Reveal";
import UsualCard from "./Usual";
import VoiceOrder from "./VoiceOrder";
import { ALLERGENS, allergensFor, canAvoid, kcalFor, type Allergen } from "@/lib/nutrition";

export default function Menu() {
  const { menu, setCustomizing, add, toast, soldOut, favs, toggleFav, t, branch } = useStore();
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [happy, setHappy] = useState(false);
  useEffect(() => setHappy(isHappyHour()), []);
  const [cat, setCat] = useState<MenuTab>("all");
  const [diet, setDiet] = useState<Diet[]>([]);
  const [avoid, setAvoid] = useState<Allergen[]>([]);
  // Signed-in guests with a dietary profile see what suits them first
  const { me } = useStore();
  const [usingProfile, setUsingProfile] = useState(false);
  useEffect(() => {
    if (!me?.diet) return;
    const d = me.diet;
    if (!d.vegan && !d.gf && !d.avoid.length) return;
    setDiet([...(d.vegan ? ["vegan" as Diet] : []), ...(d.gf ? ["gf" as Diet] : [])]);
    setAvoid(d.avoid as Allergen[]);
    setUsingProfile(true);
  }, [me?.diet]);
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    // Grouped by section; within a section, the order the owner set
    return menu.filter(
      (m) =>
        inTab(m, cat) &&
        (!m.branches?.length || m.branches.includes(branch)) &&
        (!onlyFavs || favs.has(m.id)) &&
        diet.every((d) => m.diet?.includes(d)) &&
        avoid.every((a) => canAvoid(m, a)) &&
        (!s || `${m.name} ${m.desc} ${m.badge ?? ""}`.toLowerCase().includes(s))
    ).sort((a, b) => CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat));
  }, [menu, cat, diet, avoid, q, onlyFavs, favs, branch]);

  const toggleDiet = (d: Diet) => setDiet((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  return (
    <Reveal id="menu" className="section">
      <div className="center">
        <p className="eyebrow">{t("menu.eyebrow")}</p>
        <h2>{t("menu.title1")} <em>{t("menu.title2")}</em></h2>
        <p className="lead">{t("menu.lead")}</p>
        <p className="happy-pill">{happy ? "✨ It's golden hour! " : "☀︎ "}{HAPPY_HOUR.label}</p>
      </div>

      <UsualCard />
      <VoiceOrder />

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
          {(["nuts", "egg"] as const).map((a) => (
            <button key={a} className={`chip ${avoid.includes(a) ? "on" : ""}`} aria-pressed={avoid.includes(a)} onClick={() => setAvoid((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>
              {a === "nuts" ? "Nut-free" : "Egg-free"}
            </button>
          ))}
          <button className={`chip ${onlyFavs ? "on" : ""}`} onClick={() => setOnlyFavs((v) => !v)}>{t("menu.favs")}{favs.size ? ` (${favs.size})` : ""}</button>
        </div>
      </div>

      {usingProfile && (
        <p className="center small" style={{ marginBottom: "1rem" }}>
          ✿ Showing what suits your profile ({[...diet.map((d) => (d === "gf" ? "gluten-free" : d)), ...avoid.map((a) => `no ${a}`)].join(" · ")}){" "}
          <button className="link-btn" onClick={() => { setDiet([]); setAvoid([]); setUsingProfile(false); }}>Show everything</button>
        </p>
      )}
      <div className="menu-grid">
        {items.map((m, i) => {
          const out = soldOut.has(m.id);
          return (
            <article key={m.id} className="item card" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
              <button className="item-photo" style={{ border: "none", padding: 0 }} onClick={() => setCustomizing(m)}>
                <Image src={photo(m.img, 700)} alt={`Customise ${m.name}`} fill sizes="(max-width: 600px) 90vw, 300px" />
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
                {m.cat === "shop" && m.stock !== undefined && m.stock > 0 && m.stock <= 5 && <span className="item-facts" style={{ color: "var(--pink-ink)" }}>Only {m.stock} left</span>}
                {(() => {
                  const al = allergensFor(m, defaultOptions(m));
                  const kc = kcalFor(m, defaultOptions(m));
                  if (!al.length && kc === null) return null;
                  return (
                    <span className="item-facts" title={al.length ? `Contains: ${al.join(", ")}` : undefined}>
                      {kc !== null && <>~{kc} kcal</>}
                      {al.length > 0 && <> · <span aria-hidden>{al.map((a) => ALLERGENS.find((x) => x.id === a)!.icon).join("")}</span><span className="sr-only">Contains {al.join(", ")}</span></>}
                    </span>
                  );
                })()}
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
