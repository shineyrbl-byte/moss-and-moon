"use client";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "./Store";
import { cleanOptions } from "@/lib/pricing";

/** "Order the same again" from the receipt email: /?reorder=CODE fills the tray and opens it */
export default function ReorderLink() {
  const params = useSearchParams();
  const { find, add, setDrawerOpen, toast, soldOut } = useStore();
  const done = useRef(false);
  useEffect(() => {
    const code = params.get("reorder");
    if (!code || done.current) return;
    done.current = true;
    fetch(`/api/orders/${encodeURIComponent(code)}`).then((r) => (r.ok ? r.json() : null)).then((o) => {
      if (!o?.lines) return;
      let added = 0, missing = 0;
      for (const l of o.lines as { itemId: string; opts: unknown; qty: number }[]) {
        const item = find(l.itemId);
        if (!item || soldOut.has(item.id)) { missing++; continue; }
        add(item.id, cleanOptions(item, l.opts), l.qty);
        added++;
      }
      if (added) { setDrawerOpen(true); toast(missing ? `Added what's available (${missing} item${missing === 1 ? " isn't" : "s aren't"} on today)` : "Same again, in your tray ✿"); }
      else toast("Those items aren't on the menu right now.");
      history.replaceState(null, "", location.pathname + location.hash);
    }).catch(() => {});
  }, [params, find, add, setDrawerOpen, toast, soldOut]);
  return null;
}
