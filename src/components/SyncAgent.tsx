"use client";
import { useEffect } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { synced, type Entry } from "@/lib/syncMerge";

const TIMES = "mm-sync-times";

/** When you're signed in, your game progress follows your account: this sends what's changed and takes in what's new */
export default function SyncAgent() {
  const { toast } = useStore();
  useEffect(() => {
    let off = false;
    const orig = Storage.prototype.setItem;
    let times: Record<string, number> = {};
    try { times = JSON.parse(localStorage.getItem(TIMES) ?? "{}"); } catch {}
    const dirty = new Set<string>();
    const saveTimes = () => { try { orig.call(localStorage, TIMES, JSON.stringify(times)); } catch {} };
    // Note when a game saves something, so we know what's newer
    Storage.prototype.setItem = function (k: string, v: string) {
      orig.call(this, k, v);
      if (this === window.localStorage && synced(k)) { times[k] = Date.now(); dirty.add(k); saveTimes(); }
    };
    async function sync(all: boolean) {
      if (off) return;
      let keys: string[];
      try { keys = all ? Object.keys(localStorage).filter(synced) : [...dirty]; } catch { return; }
      if (!all && !keys.length) return;
      dirty.clear();
      const data: Record<string, Entry> = {};
      for (const k of keys) { const v = localStorage.getItem(k); if (v !== null) data[k] = { v, t: times[k] ?? 0 }; }
      try {
        const r = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), data }), keepalive: !all });
        if (r.status === 401) { off = true; return; }
        const d = await r.json() as { data?: Record<string, Entry> };
        if (!d.data) return;
        let changed = 0;
        for (const [k, e] of Object.entries(d.data)) if (localStorage.getItem(k) !== e.v) { orig.call(localStorage, k, e.v); times[k] = e.t; changed++; }
        if (changed) { saveTimes(); if (all) toast("Your games are synced with your account ☁️"); }
      } catch {}
    }
    void sync(true);
    const id = setInterval(() => void sync(false), 30_000);
    const hide = () => { if (document.visibilityState === "hidden") void sync(false); };
    document.addEventListener("visibilitychange", hide);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", hide); Storage.prototype.setItem = orig; };
  }, [toast]);
  return null;
}
