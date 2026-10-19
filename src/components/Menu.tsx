"use client";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_ORDER, inTab, itemDesc, itemName, photo, type Diet, type MenuTab } from "@/lib/menu";
import { HAPPY_HOUR, combosAt, combosConfig, defaultOptions, isHappyHour, rupees } from "@/lib/pricing";
import { hourText } from "@/lib/cafe";
import { isLastHour, lastHourLabel } from "@/lib/cafe";
import { useStore } from "./Store";
import { fill } from "@/lib/i18n";
import Reveal from "./Reveal";
import UsualCard from "./Usual";
import VoiceOrder from "./VoiceOrder";
import { ALLERGENS, allergensFor, canAvoid, kcalFor, type Allergen } from "@/lib/nutrition";

export default function Menu() {
  const { menu, setCustomizing, add, toast, soldOut, favs, toggleFav, t, branch, lang } = useStore();
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [happy, setHappy] = useState(false);
  useEffect(() => setHappy(isHappyHour()), []);
  const [lastNow, setLastNow] = useState(false);
  const [combos, setCombos] = useState<ReturnType<typeof combosConfig>>([]);
  useEffect(() => { const f = () => setCombos(combosAt(combosConfig())); f(); const t = setInterval(f, 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { setLastNow(isLastHour(new Date(), branch)); const t = setInterval(() => setLastNow(isLastHour(new Date(), branch)), 60_000); return () => clearInterval(t); }, [branch]);
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

  // "Everything" with no search: one block per section, the first few of each, with "Show all"
  const [openCats, setOpenCats] = useState<string[]>([]);
  const PER_SECTION = 8;
  const blocks = useMemo(() => {
    if (cat !== "all" || q.trim() || onlyFavs) return [{ id: "all", label: null as string | null, shown: items, total: items.length, more: 0 }];
    return CATEGORY_ORDER.map((c) => {
      const list = items.filter((m) => m.cat === c);
      const all = openCats.includes(c);
      return { id: c as string, label: t(`menu.${c}` as "menu.all").replace(/\s*\p{Extended_Pictographic}\uFE0F?/gu, ""), shown: all ? list : list.slice(0, PER_SECTION), total: list.length, more: all ? 0 : Math.max(0, list.length - PER_SECTION) };
    }).filter((b) => b.total);
  }, [items, cat, q, onlyFavs, openCats, t]);

  const toggleDiet = (d: Diet) => setDiet((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  return (
    <Reveal id="menu" className="section">
      <div className="center">
        <p className="eyebrow">{t("menu.eyebrow")}</p>
        <h2>{t("menu.title1")} <em>{t("menu.title2")}</em></h2>
        <p className="lead">{t("menu.lead")}</p>
        <p className="happy-pill">{happy ? "✨ It's golden hour! " : "☀︎ "}{HAPPY_HOUR.label}</p>
        {lastNow && <p className="happy-pill" style={{ marginTop: "0.4rem" }}>🌙 {lastHourLabel()}</p>}
        {combos.length > 0 && (
          <div className="combo-strip">
            {combos.map((c) => <span key={c.id} className="combo-pill">🍱 <b>{c.name}</b>: {c.slots.map((s) => s.label.toLowerCase()).join(" + ")} for {rupees(c.price)}{c.from !== undefined ? ` · ${hourText(c.from)}–${hourText(c.to!)}` : ""}</span>)}
          </div>
        )}
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
          {(["nuts", "egg", "shellfish"] as const).map((a) => (
            <button key={a} className={`chip ${avoid.includes(a) ? "on" : ""}`} aria-pressed={avoid.includes(a)} onClick={() => setAvoid((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}>
              {t(a === "nuts" ? "menu.nutFree" : a === "egg" ? "menu.eggFree" : "menu.noShellfish")}
            </button>
          ))}
          <button className={`chip ${onlyFavs ? "on" : ""}`} onClick={() => setOnlyFavs((v) => !v)}>{t("menu.favs")}{favs.size ? ` (${favs.size})` : ""}</button>
        </div>
      </div>

      {usingProfile && (
        <p className="center small" style={{ marginBottom: "1rem" }}>
          {t("menu.profile")} ({[...diet.map((d) => (d === "gf" ? "gluten-free" : d)), ...avoid.map((a) => `no ${a}`)].join(" · ")}){" "}
          <button className="link-btn" onClick={() => { setDiet([]); setAvoid([]); setUsingProfile(false); }}>{t("menu.showEverything")}</button>
        </p>
      )}
      {cat === "all" && !q && !onlyFavs && !diet.length && !avoid.length && (() => {
        const strip = (title: string, list: typeof menu) => list.length > 0 && (
          <section className="pick-strip" aria-label={title}>
            <h3>{title}</h3>
            <div className="pick-row">
              {list.slice(0, 8).map((m) => (
                <button key={m.id} className="pick-card" onClick={() => setCustomizing(m)} disabled={soldOut.has(m.id)}>
                  <span className="pick-ph"><Image src={photo(m.img, 300)} alt="" fill sizes="140px" /></span>
                  <b>{itemName(m, lang)}</b>
                  <small className="muted">{rupees(m.price)}</small>
                </button>
              ))}
            </div>
          </section>
        );
        const here = (m: (typeof menu)[number]) => !m.branches?.length || m.branches.includes(branch);
        return (
          <>
            {strip(t("menu.staffPicks"), menu.filter((m) => m.staffPick && here(m)))}
            {strip(t("menu.newThisMonth"), menu.filter((m) => m.badge === "new" && !m.staffPick && here(m)))}
          </>
        );
      })()}
      {blocks.map((blk) => (
      <Fragment key={blk.id}>
      {blk.label && <h3 className="menu-section-title" id={`menu-${blk.id}`}>{blk.label} <span className="muted small">· {blk.total}</span></h3>}
      <div className="menu-grid">
        {blk.shown.map((m, i) => {
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
                <h3 style={{ cursor: "pointer" }} onClick={() => setCustomizing(m)} lang={itemName(m, lang) !== m.name ? lang : undefined}>{itemName(m, lang)}</h3>
                {happy && m.cat === "bakes" && <span className="small" style={{ color: "var(--pink-deep)" }}>golden hour −20%</span>}
                <p lang={itemDesc(m, lang) !== m.desc ? lang : undefined}>{itemDesc(m, lang)}</p>
                {m.loved !== undefined && m.loved >= 80 && <span className="loved">❤ Loved by {m.loved}%</span>}
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
                      // Build-your-own and flights need choosing first
                      if (m.groups?.length) return setCustomizing(m);
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
      {blk.more > 0 && <button className="btn btn-ghost btn-sm menu-more" onClick={() => setOpenCats((o) => [...o, blk.id])}>{fill(t("menu.showAll"), { n: blk.total, label: blk.label?.toLowerCase() ?? "" })}</button>}
      </Fragment>
      ))}
      {!items.length && <p className="empty-state">{onlyFavs && !favs.size ? "Tap the ♡ on anything you love and it'll live here." : t("menu.empty")}</p>}
    </Reveal>
  );
}
