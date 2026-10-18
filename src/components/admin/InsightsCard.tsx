"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";
import type { BusinessInsights, ReviewSummary } from "@/lib/insights";

type Resp<T> = { at: string; provider: string; ai: string | null; data: T };
const KIND_ICON: Record<string, string> = { promote: "📣", drop: "✂️", staff: "👥", price: "🏷", stock: "📦", other: "💡" };

/** Owner: AI ideas from the café's numbers, or a summary of the week's reviews */
export default function InsightsCard({ kind }: { kind: "business" | "reviews" }) {
  const { toast } = useStore();
  const [r, setR] = useState<Resp<BusinessInsights | ReviewSummary> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((fresh = false) => {
    setBusy(true);
    fetch(`/api/admin/insights?kind=${kind}`, { method: fresh ? "POST" : "GET" })
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) toast(d.error);
        else setR(d);
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [kind, toast]);
  useEffect(() => { load(); }, [load]);

  const when = r ? new Date(r.at).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "";
  const by = r?.provider === "claude" ? "Claude" : r?.provider === "gemini" ? "Gemini" : null;

  return (
    <section className="card insights">
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.3rem" }}>{kind === "business" ? "✨ Ideas for this week" : "💬 What guests said this week"}</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => load(true)} disabled={busy}>{busy ? "Thinking…" : "Refresh"}</button>
      </div>
      {!r && <p className="muted small">Loading…</p>}
      {r && kind === "business" && (() => {
        const d = r.data as BusinessInsights;
        return (
          <>
            <p>{d.headline}</p>
            <ol className="insight-list">
              {d.suggestions.map((s, i) => (
                <li key={i}>
                  <span aria-hidden>{KIND_ICON[s.kind] ?? "💡"}</span>
                  <div><b>{s.title}</b><p className="small muted">{s.why}</p><p className="small">→ {s.action}</p></div>
                </li>
              ))}
            </ol>
          </>
        );
      })()}
      {r && kind === "reviews" && (() => {
        const d = r.data as ReviewSummary;
        return (
          <>
            <p>{d.mood}</p>
            {d.quote && <blockquote className="gift-msg" style={{ fontSize: "1.15rem" }}>“{d.quote}”</blockquote>}
            <div className="insight-cols">
              {d.loved.length > 0 && <div><b className="small">Loved</b><ul className="small">{d.loved.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {d.improve.length > 0 && <div><b className="small">To improve</b><ul className="small">{d.improve.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            </div>
            {d.actions.length > 0 && <p className="small"><b>Try this week:</b> {d.actions.join(" · ")}</p>}
          </>
        );
      })()}
      {r && (
        <p className="tiny muted">
          {by ? `Written by ${by} from your café's data · ${when}. Double-check before acting.` : `Simple summary (no AI key set) · ${when}. Add a free Gemini key for smarter ideas.`}
        </p>
      )}
    </section>
  );
}
