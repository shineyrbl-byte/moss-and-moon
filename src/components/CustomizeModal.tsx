"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useEscape, useStore } from "./Store";
import DrinkCup from "./DrinkCup";
import { useRouter } from "next/navigation";
import { photo } from "@/lib/menu";
import { MILKS, SHOT_PRICE, SIZES, SWEETS, TEMPS, defaultOptions, isDrink, rupees, unitPrice, type Options } from "@/lib/pricing";

// Pop-up for choosing size, milk, sweetness etc. before adding to the tray.
export default function CustomizeModal() {
  const { customizing: item, setCustomizing, add, toast, soldOut } = useStore();
  const [opts, setOpts] = useState<Options>({});
  const [qty, setQty] = useState(1);
  const router = useRouter();

  useEffect(() => {
    if (item) {
      setOpts(defaultOptions(item));
      setQty(1);
    }
  }, [item]);

  const close = useCallback(() => setCustomizing(null), [setCustomizing]);
  useEscape(!!item, close);
  if (!item) return null;

  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpts((o) => ({ ...o, [k]: v }));
  const drink = isDrink(item.cat);
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
              <h3 style={{ fontSize: "2rem" }}>{item.name}</h3>
              <p className="muted">{item.desc}</p>
            </div>
            {drink && <DrinkCup item={item} opts={opts} />}
          </div>

          {drink ? (
            <>
              {group("Size", "size", SIZES)}
              {group("Hot or iced", "temp", TEMPS)}
              {group("Milk", "milk", MILKS)}
              {group("Sweetness", "sweet", SWEETS)}
              {item.cat === "coffee" && (
                <div className="toggle-row">
                  <span>Extra espresso shot <span className="muted small">+₹{SHOT_PRICE}</span></span>
                  <button className={`switch ${opts.shot ? "" : "off"}`} onClick={() => set("shot", !opts.shot)} aria-pressed={!!opts.shot} aria-label="Extra shot" />
                </div>
              )}
            </>
          ) : (
            <div className="toggle-row">
              <span>Warm it up for me ♨</span>
              <button className={`switch ${opts.warm ? "" : "off"}`} onClick={() => set("warm", !opts.warm)} aria-pressed={!!opts.warm} aria-label="Warm it up" />
            </div>
          )}

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
                toast(`${qty > 1 ? qty + " × " : ""}${item.name} added ✿`);
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
