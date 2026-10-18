"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";

type E = { id: number; source: string; message: string; detail: string | null; count: number; first_at: string; last_at: string };

/** Owner: problems the site has run into, grouped, newest first */
export default function HealthTab() {
  const { toast } = useStore();
  const [errors, setErrors] = useState<E[] | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; uptime: number } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch("/api/errors").then((r) => r.json()).then((d) => setErrors(d.errors)).catch(() => {});
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: false, uptime: 0 }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function clear() {
    await fetch("/api/errors", { method: "DELETE" });
    toast("Cleared ✓");
    load();
  }

  const up = health ? (health.uptime > 86400 ? `${Math.floor(health.uptime / 86400)} days` : health.uptime > 3600 ? `${Math.floor(health.uptime / 3600)} hours` : `${Math.floor(health.uptime / 60)} minutes`) : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="mode-banner">
        <span>{health?.ok ? "✅" : "⚠️"} Site: <b>{health ? (health.ok ? "running" : "having trouble") : "checking…"}</b>{health?.ok ? ` · up for ${up}` : ""}</span>
        <span>🚨 Problems logged: <b>{errors?.length ?? "…"}</b></span>
        {!!errors?.length && <button className="btn btn-ghost btn-sm" onClick={clear}>Clear the list</button>}
      </div>
      <p className="small muted">Errors from the server, visitors&apos; browsers, emails, payments and background jobs show up here. Turn on email alerts in Overview → Emails for you.</p>
      {errors && !errors.length && <p className="muted center" style={{ padding: "2rem 0" }}>All quiet. Nothing has gone wrong ✿</p>}
      {errors?.map((e) => (
        <article key={e.id} className="card error-row">
          <button className="error-head" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
            <span className={`status-tag error-${e.source}`}>{e.source}</span>
            <span className="error-msg">{e.message}</span>
            <span className="small muted">{e.count > 1 ? `${e.count}× · ` : ""}{e.last_at.slice(5, 16)}</span>
          </button>
          {open === e.id && (
            <pre className="error-detail">{`First seen ${e.first_at}\n${e.detail ?? ""}`}</pre>
          )}
        </article>
      ))}
    </div>
  );
}
