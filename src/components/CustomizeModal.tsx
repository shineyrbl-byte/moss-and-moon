"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useEscape, useStore } from "./Store";
import DrinkCup from "./DrinkCup";
import BackInStock from "./BackInStock";
import { wholeCake } from "@/lib/cakes";
import { ALLERGENS, allergensFor, kcalFor } from "@/lib/nutrition";
import { useRouter } from "next/navigation";
import { itemName, photo } from "@/lib/menu";
import { ICE, ITEM_NOTE_MAX, MILKS, SHOT_PRICE, SIZES, SWEETS, SYRUPS, TEMPS, TOPPINGS, cleanOptions, defaultOptions, drinkChoices, isDrink, rupees, unitPrice, type Options } from "@/lib/pricing";

let pairCache: Record<string, string> | null = null;

// Pop-up for choosing size, milk, sweetness etc. before adding to the tray.
export default function CustomizeModal() {
  const { customizing: item, setCustomizing, add, toast, soldOut, me, find, lang } = useStore();
  const [opts, setOpts] = useState<Options>({});
  const [qty, setQty] = useState(1);
  const [pairs, setPairs] = useState<Record<string, string>>(pairCache ?? {});
  const [paired, setPaired] = useState(false);
  useEffect(() => {
    if (pairCache) return;
    fetch("/api/pairings").then((r) => r.json()).then((d) => { pairCache = d; setPairs(d); }).catch(() => {});
  }, []);
  const router = useRouter();

  useEffect(() => {
    if (item) {
      setOpts(defaultOptions(item));
      setQty(1);
      setPaired(false);
    }
  }, [item]);

  const close = useCallback(() => setCustomizing(null), [setCustomizing]);
  useEscape(!!item, close);
  if (!item) return null;

  // Always run choices through the same rules the server uses (e.g. switching to iced swaps "extra hot" for an ice level)
  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpts((o) => cleanOptions(item, { ...o, [k]: v }));
  const toggleIn = (k: "toppings" | "addons", v: string) =>
    setOpts((o) => cleanOptions(item, { ...o, [k]: ((o[k] as string[] | undefined) ?? []).includes(v) ? (o[k] as string[]).filter((x) => x !== v) : [...((o[k] as string[] | undefined) ?? []), v] }));
  const can = drinkChoices(item);
  const groups = item.groups ?? [];
  const drink = isDrink(item.cat) && !groups.length;
  const unit = unitPrice(item, opts);
  const out = soldOut.has(item.id);

  const group = <V extends string>(title: string, key: keyof Options, list: { value: V; label: string; extra: number }[]) => (
    <div className="opt-group">
      <h4>{title}</h4>
      <div className="chips">
        {list.map((c) => (
          <button key={c.value} className={`chip ${opts[key] === c.value ? "on" : ""}`} onClick={() => set(key, c.value as never)}>
            {c.label}
            {c.extra !== 0 && <span className="extra"> {c.extra > 0 ? "+" : "−"}₹{Math.abs(c.extra)}</span>}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="overlay show" onClick={close} />
      <div className="modal card" role="dialog" aria-modal="true" aria-label={`Customise ${item.name}`}>
        <div className="modal-photo">
          <Image src={photo(item.img, 1000)} alt={item.name} fill sizes="520px" />
          <button className="icon-btn close-x" onClick={close} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-title-row">
            <div>
              <h3 style={{ fontSize: "2rem" }}>{itemName(item, lang)}</h3>
              <p className="muted">{item.desc}</p>
              {item.cat !== "shop" && (() => {
                const al = allergensFor(item, opts);
                const kc = kcalFor(item, opts);
                // Clash with the guest's dietary profile?
                const avoid = me?.diet?.avoid ?? [];
                const clash = al.filter((a) => avoid.includes(a) || (me?.diet?.vegan && (a === "milk" || a === "egg")) || (me?.diet?.gf && a === "gluten"));
                return (
                  <>
                  {clash.length > 0 && <p className="diet-warn" role="alert">⚠️ Contains {clash.join(", ")}, which your profile says to avoid{al.includes("milk") && item.cat !== "bakes" && !item.noMilk ? ". Try a different milk." : "."}</p>}
                  <p className="small facts" aria-live="polite">
                    {al.length ? <>Contains: <b>{al.map((a) => ALLERGENS.find((x) => x.id === a)!.label.toLowerCase()).join(", ")}</b></> : "No common allergens"}
                    {kc !== null && <> · about {kc * qty} kcal</>}
                  </p>
                  </>
                );
              })()}
            </div>
            {drink && <DrinkCup item={item} opts={opts} />}
          </div>

          {groups.map((g) => {
            const chosen = opts.picks?.[g.id] ?? [];
            const one = g.max === 1;
            const toggle = (id: string) => setOpts((o) => {
              const cur = o.picks?.[g.id] ?? [];
              const next = one ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= g.max ? cur : [...cur, id];
              return cleanOptions(item, { ...o, picks: { ...(o.picks ?? {}), [g.id]: next } });
            });
            return (
              <div key={g.id} className="opt-group">
                <h4>{g.label}{!one && <span className="muted small" style={{ textTransform: "none", letterSpacing: 0 }}> · {chosen.length}/{g.max}</span>}</h4>
                <div className="chips" role={one ? "radiogroup" : "group"} aria-label={g.label}>
                  {g.choices.map((c) => {
                    const on = chosen.includes(c.id);
                    const full = !one && !on && chosen.length >= g.max;
                    return (
                      <button key={c.id} role={one ? "radio" : undefined} aria-checked={one ? on : undefined} aria-pressed={one ? undefined : on} disabled={full} className={`chip ${on ? "on" : ""}`} onClick={() => toggle(c.id)}>
                        {c.label}{c.price > 0 && <span className="extra"> +₹{c.price}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {groups.length > 0 && item.cat === "shop" && <p className="small muted">✍️ Write your card message in “Anything we should know?” at checkout. Pick it up or have it delivered.</p>}
          {groups.length > 0 ? null : drink ? (
            <>
              {group("Size", "size", SIZES)}
              {can.temp && group("Hot or iced", "temp", TEMPS)}
              {opts.temp === "iced" && group("Ice", "ice", ICE)}
              {can.milk && group("Milk", "milk", MILKS)}
              {group("Sweetness", "sweet", SWEETS)}
              {can.syrup && group("Syrup", "syrup", SYRUPS)}
              {can.toppings && (
                <div className="opt-group">
                  <h4>Toppings <span className="muted small" style={{ textTransform: "none", letterSpacing: 0 }}>· pick any</span></h4>
                  <div className="chips">
                    {TOPPINGS.map((t) => {
                      const on = !!opts.toppings?.includes(t.value);
                      return (
                        <button key={t.value} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggleIn("toppings", t.value)}>
                          {t.label}{t.extra > 0 && <span className="extra"> +₹{t.extra}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {can.shot && (
                <div className="toggle-row">
                  <span>Extra espresso shot <span className="muted small">+₹{SHOT_PRICE}</span></span>
                  <button className={`switch ${opts.shot ? "" : "off"}`} onClick={() => set("shot", !opts.shot)} aria-pressed={!!opts.shot} aria-label="Extra shot" />
                </div>
              )}
              {can.decaf && (
                <div className="toggle-row">
                  <span>Decaf <span className="muted small">· same taste, no buzz</span></span>
                  <button className={`switch ${opts.decaf ? "" : "off"}`} onClick={() => set("decaf", !opts.decaf)} aria-pressed={!!opts.decaf} aria-label="Decaf" />
                </div>
              )}
              {opts.temp === "hot" && (
                <div className="toggle-row">
                  <span>Extra hot 🔥</span>
                  <button className={`switch ${opts.extraHot ? "" : "off"}`} onClick={() => set("extraHot", !opts.extraHot)} aria-pressed={!!opts.extraHot} aria-label="Extra hot" />
                </div>
              )}
            </>
          ) : item.cat === "shop" ? (
            <>
              {!!item.variants?.length && item.variants.length > 1 && (
                <div className="opt-group">
                  <h4>Choose</h4>
                  <div className="chips">
                    {item.variants.map((v) => (
                      <button key={v.id} className={`chip ${opts.variant === v.id ? "on" : ""}`} onClick={() => set("variant", v.id)}>
                        {v.label}{v.price > 0 && <span className="extra"> +₹{v.price}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {item.stock !== undefined && item.stock <= 5 && item.stock > 0 && <p className="small" style={{ color: "var(--pink-ink)" }}>Only {item.stock} left</p>}
              <p className="small muted">Pick up at the counter, or choose delivery at checkout.</p>
              {/beans/.test(item.id) && (
                <p className="small"><button className="link-btn" onClick={() => { close(); router.push(me ? `/account?subscribe=${item.id}#beans` : "/account"); }}>☕ Get a bag every 2 or 4 weeks{me ? "" : " (sign in)"} →</button></p>
              )}
            </>
          ) : (
            <>
              {wholeCake(item.id) && <p className="small"><button className="link-btn" onClick={() => { close(); router.push(`/cakes?item=${item.id}`); }}>🎂 Order it as a whole cake, with a message on top →</button></p>}
              {item.half && (
                <div className="toggle-row">
                  <span>Half portion <span className="muted small">· smaller appetite or for a little one</span></span>
                  <button className={`switch ${opts.half ? "" : "off"}`} onClick={() => setOpts((o) => cleanOptions(item, { ...o, half: !o.half }))} aria-pressed={!!opts.half} aria-label="Half portion" />
                </div>
              )}
              {item.cat === "bakes" && (
                <div className="toggle-row">
                  <span>Warm it up for me ♨</span>
                  <button className={`switch ${opts.warm ? "" : "off"}`} onClick={() => set("warm", !opts.warm)} aria-pressed={!!opts.warm} aria-label="Warm it up" />
                </div>
              )}
              {!!item.addons?.length && (
                <div className="opt-group">
                  <h4>Add-ons</h4>
                  <div className="addon-list">
                    {item.addons.map((a) => {
                      const on = !!opts.addons?.includes(a.id);
                      return (
                        <label key={a.id} className={`addon ${on ? "on" : ""}`}>
                          <input type="checkbox" checked={on} onChange={() => toggleIn("addons", a.id)} />
                          <span>{a.label}</span>
                          <span className="muted small">{a.price ? `+${rupees(a.price)}` : "free"}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {out && <BackInStock itemId={item.id} name={item.name} email={me?.email ?? ""} />}
          {(() => {
            const p = pairs[item.id] ? find(pairs[item.id]) : undefined;
            if (!p || soldOut.has(p.id)) return null;
            return (
              <div className="pair-row">
                <span className="pair-ph"><Image src={photo(p.img, 160)} alt="" fill sizes="48px" /></span>
                <span><small className="muted">Goes well with</small><br /><b>{itemName(p, lang)}</b> <span className="muted small">{rupees(p.price)}</span></span>
                <button className="btn btn-ghost btn-sm" disabled={paired} onClick={() => { add(p.id, defaultOptions(p), 1); setPaired(true); toast(`${itemName(p, lang)} added too ✿`); }}>{paired ? "Added ✓" : "+ Add"}</button>
              </div>
            );
          })()}
          {item.cat !== "shop" && (
            <label className="field small" style={{ marginTop: "0.4rem" }}>Anything for this one? <span className="muted">· optional</span>
              <input className="input" maxLength={ITEM_NOTE_MAX} placeholder={drink ? "e.g. less ice, extra hot, no foam" : "e.g. cut in half, sauce on the side"} value={opts.note ?? ""} onChange={(e) => setOpts((o) => ({ ...o, note: e.target.value || undefined }))} />
            </label>
          )}
          {item.cat !== "shop" && <p className="tiny muted">Allergens and calories are approximate. Our kitchen handles nuts, gluten, milk, egg, soy, sesame and shellfish, so please tell us about severe allergies.</p>}
          <div className="toggle-row">
            <div className="stepper">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One less">−</button>
              <strong>{qty}</strong>
              <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="One more">+</button>
            </div>
            <span className="modal-actions">
            {drink && !out && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { close(); router.push(`/gift-a-drink?item=${encodeURIComponent(item.id)}&o=${encodeURIComponent(JSON.stringify(opts))}`); }}
                title="Buy this drink for a friend"
              >
                🎁 Gift it
              </button>
            )}
            <button
              className="btn btn-pink"
              disabled={out}
              onClick={() => {
                add(item.id, opts, qty);
                toast(`${qty > 1 ? qty + " × " : ""}${itemName(item, lang)} added ✿`);
                close();
              }}
            >
              {out ? "Sold out" : `Add · ${rupees(unit * qty)}`}
            </button>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
