"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { photo } from "@/lib/menu";
import { rupees, type Options } from "@/lib/pricing";
import { getHistory } from "@/lib/history";
import { useStore } from "./Store";

type Usual = { itemId: string; name: string; img: string; opts: Options; note: string; price: number; orders: number; soldOut: boolean };

/** One-tap "my usual" above the menu, for anyone who has ordered before */
export default function UsualCard() {
  const { add, toast, me, setDrawerOpen } = useStore();
  const [u, setU] = useState<Usual | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const codes = getHistory().map((o) => o.code).join(",");
    if (!me && !codes) return;
    fetch(`/api/usual?codes=${encodeURIComponent(codes)}`).then((r) => r.json()).then((d) => setU(d.usual)).catch(() => {});
    try { setHidden(sessionStorage.getItem("mm-usual-hide") === "1"); } catch {}
  }, [me]);

  if (!u || hidden) return null;
  const isUsual = u.orders >= 2;
  return (
    <div className="usual card">
      <div className="usual-photo"><Image src={photo(u.img, 200)} alt="" fill sizes="64px" /></div>
      <div className="usual-info">
        <span className="eyebrow" style={{ margin: 0 }}>{isUsual ? "your usual" : "last time you had"}</span>
        <strong>{u.name}</strong>
        <small className="muted">{u.note || "as it comes"} · {rupees(u.price)}</small>
      </div>
      <button
        className="btn btn-pink btn-sm"
        disabled={u.soldOut}
        onClick={() => {
          add(u.itemId, u.opts, 1);
          toast(`${u.name} added, just how you like it ✿`);
          setDrawerOpen(true);
        }}
      >
        {u.soldOut ? "Sold out today" : isUsual ? "☕ The usual, please" : "Order again"}
      </button>
      <button
        className="icon-btn usual-x"
        aria-label="Hide this"
        onClick={() => {
          setHidden(true);
          try { sessionStorage.setItem("mm-usual-hide", "1"); } catch {}
        }}
      >
        ✕
      </button>
    </div>
  );
}
