"use client";
// Shared app state: the live menu, the order tray, toasts, the table you're
// ordering from, and which item is being customised.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { MenuItem } from "@/lib/menu";
import { lineKey, type CartLine, type Options } from "@/lib/pricing";
import { TABLE_COUNT } from "@/lib/cafe";
import { DICT, type Lang, type TKey } from "@/lib/i18n";

export type Me = {
  name: string | null; email: string; phone: string | null; birthday: string | null; favs: string[]; referralCode: string; credit: number;
  perks?: { birthdayTreat: boolean; passDrink: boolean; credit: number; canUseInvite: boolean };
};

type Store = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  me: Me | null;
  refreshMe: () => Promise<void>;
  menu: MenuItem[];
  find: (id: string) => MenuItem | undefined;
  table: number | null;
  setTable: (n: number | null) => void;
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

export function StoreProvider({ children, initialMenu }: { children: React.ReactNode; initialMenu: MenuItem[] }) {
  const [menu, setMenu] = useState<MenuItem[]>(initialMenu);
  const [table, setTableState] = useState<number | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [bumpKey, setBumpKey] = useState(0);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<Me | null>(null);
  const [lang, setLangState] = useState<Lang>("en");
  const favsSynced = useRef(false);
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

  // Keep the menu (and sold-out flags) fresh
  const refreshSoldOut = useCallback(() => {
    fetch("/api/menu").then((r) => r.json()).then((d) => Array.isArray(d.items) && setMenu(d.items)).catch(() => {});
  }, []);
  useEffect(() => {
    refreshSoldOut();
    const t = setInterval(refreshSoldOut, 60_000);
    return () => clearInterval(t);
  }, [refreshSoldOut]);
  const soldOut = useMemo(() => new Set(menu.filter((m) => m.soldOut).map((m) => m.id)), [menu]);
  const find = useCallback((id: string) => menu.find((m) => m.id === id), [menu]);

  // Ordering from a table: the QR code opens /?table=5 — remember it for this visit
  useEffect(() => {
    try {
      const fromUrl = Number(new URLSearchParams(window.location.search).get("table"));
      const n = fromUrl || Number(sessionStorage.getItem("mm-table"));
      if (n >= 1 && n <= TABLE_COUNT) {
        setTableState(n);
        sessionStorage.setItem("mm-table", String(n));
      }
    } catch {}
  }, []);
  const setTable = useCallback((n: number | null) => {
    setTableState(n);
    try {
      if (n) sessionStorage.setItem("mm-table", String(n));
      else sessionStorage.removeItem("mm-table");
    } catch {}
  }, []);

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

  // Language: remembered per browser
  useEffect(() => {
    try {
      const l = localStorage.getItem("mm-lang");
      if (l === "hi") {
        setLangState("hi");
        document.documentElement.lang = "hi";
      }
    } catch {}
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try { localStorage.setItem("mm-lang", l); } catch {}
  }, []);
  const t = useCallback((k: TKey) => DICT[lang][k] ?? DICT.en[k], [lang]);

  // Signed-in guest: load their profile and merge favourites from all their devices
  const refreshMe = useCallback(async () => {
    try {
      const d = await fetch("/api/account").then((r) => r.json());
      if (!d.signedIn) {
        setMe(null);
        favsSynced.current = false;
        return;
      }
      setMe({ ...d.customer, perks: d.perks });
      setFavs((local) => {
        const merged = new Set([...local, ...(d.customer.favs as string[])]);
        try { localStorage.setItem("mm-favs", JSON.stringify([...merged])); } catch {}
        return merged;
      });
      favsSynced.current = true;
    } catch {}
  }, []);
  useEffect(() => { refreshMe(); }, [refreshMe]);
  useEffect(() => {
    if (!me || !favsSynced.current) return;
    fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favs: [...favs] }) }).catch(() => {});
  }, [favs, me]);

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
      lang,
      setLang,
      t,
      me,
      refreshMe,
      menu,
      find,
      table,
      setTable,
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
    [lang, setLang, t, me, refreshMe, menu, find, table, setTable, lines, add, setQty, drawerOpen, customizing, soldOut, refreshSoldOut, toast, bumpKey, favs, toggleFav]
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
