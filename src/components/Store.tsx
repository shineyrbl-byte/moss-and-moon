"use client";
// Shared app state: the order tray, toasts, and which item is being customised.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { MenuItem } from "@/lib/menu";
import { lineKey, type CartLine, type Options } from "@/lib/pricing";

type Store = {
  lines: CartLine[];
  count: number;
  add: (itemId: string, opts: Options, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  customizing: MenuItem | null;
  setCustomizing: (m: MenuItem | null) => void;
  soldOut: Set<string>;
  refreshSoldOut: () => void;
  toast: (msg: string) => void;
  bumpKey: number;
  favs: Set<string>;
  toggleFav: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);
const STORAGE = "mm-tray-v2";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [soldOut, setSoldOut] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [bumpKey, setBumpKey] = useState(0);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const toastId = useRef(0);

  // Load the tray saved in this browser
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      if (Array.isArray(saved)) setLines(saved);
      setFavs(new Set(JSON.parse(localStorage.getItem("mm-favs") || "[]")));
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE, JSON.stringify(lines)); } catch {}
  }, [lines, loaded]);

  const refreshSoldOut = useCallback(() => {
    fetch("/api/menu").then((r) => r.json()).then((d) => setSoldOut(new Set(d.soldOut))).catch(() => {});
  }, []);
  useEffect(refreshSoldOut, [refreshSoldOut]);

  const toast = useCallback((msg: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const add = useCallback((itemId: string, opts: Options, qty = 1) => {
    const key = lineKey(itemId, opts);
    setLines((ls) => {
      const hit = ls.find((l) => l.key === key);
      if (hit) return ls.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
      return [...ls, { key, itemId, opts, qty }];
    });
    setBumpKey((k) => k + 1);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, qty: Math.min(20, qty) } : l))));
  }, []);

  const toggleFav = useCallback((id: string) => {
    setFavs((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      try { localStorage.setItem("mm-favs", JSON.stringify([...n])); } catch {}
      return n;
    });
  }, []);

  const value = useMemo<Store>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      add,
      setQty,
      clear: () => setLines([]),
      drawerOpen,
      setDrawerOpen,
      customizing,
      setCustomizing,
      soldOut,
      refreshSoldOut,
      toast,
      bumpKey,
      favs,
      toggleFav,
    }),
    [lines, add, setQty, drawerOpen, customizing, soldOut, refreshSoldOut, toast, bumpKey, favs, toggleFav]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}

/** Close on Escape key */
export function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [active, onClose]);
}
