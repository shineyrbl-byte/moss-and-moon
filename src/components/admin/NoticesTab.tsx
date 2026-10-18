"use client";
import { useCallback, useEffect, useState } from "react";
import { KINDS } from "../Noticeboard";
import { useStore } from "../Store";

type N = { id: number; kind: string; name: string; text: string; contact: string | null; status: string; expires: string; created_at: string };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Staff: approve noticeboard notes before they go up */
export default function NoticesTab() {
  const { toast } = useStore();
  const [list, setList] = useState<N[] | null>(null);
  const load = useCallback(() => fetch("/api/notices?all=1").then((r) => r.json()).then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  async function act(method: "PATCH" | "DELETE", body: object, msg: string) {
    const r = await fetch("/api/notices", json(method, body));
    if (!r.ok) return toast((await r.json()).error);
    toast(msg);
    load();
  }
  if (!list) return <p className="muted">Loading…</p>;
  const pending = list.filter((n) => n.status === "pending");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
      <p className="small muted">{pending.length ? `${pending.length} waiting for a look.` : "Nothing waiting."} Approved notes stay up until their end date.</p>
      {list.map((n) => (
        <div key={n.id} className="card promo-row">
          <div style={{ flex: 1, minWidth: 220 }}>
            <span className="small">{KINDS[n.kind]?.icon} {KINDS[n.kind]?.label}</span> <span className={`status-tag notice-${n.status}`}>{n.status}</span>
            <p style={{ margin: "0.3rem 0" }}>{n.text}</p>
            <p className="small muted">{n.name}{n.contact ? ` · ${n.contact}` : ""} · {n.created_at.slice(0, 16)} · until {n.expires}</p>
          </div>
          <div className="row" style={{ gap: "0.4rem" }}>
            {n.status !== "approved" && <button className="btn btn-pink btn-sm" onClick={() => act("PATCH", { id: n.id, status: "approved" }, "Pinned ✓")}>Approve</button>}
            {n.status !== "rejected" && <button className="btn btn-ghost btn-sm" onClick={() => act("PATCH", { id: n.id, status: "rejected" }, "Hidden")}>Hide</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => act("DELETE", { id: n.id }, "Deleted")} aria-label="Delete note">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
