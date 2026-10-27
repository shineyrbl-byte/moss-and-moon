"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type S = { id: number; title: string; artist: string; name: string; table_no: number | null; status: "pending" | "queued" | "playing" | "played"; created_at: string; votes?: number };

/** Orders tab: song requests. Approve, play (the TV board shows it), or remove. */
export default function SongsCard() {
  const { toast } = useStore();
  const [list, setList] = useState<S[]>([]);
  const load = () => fetch("/api/songs?all=1").then((r) => (r.ok ? r.json() : { songs: [] })).then((d) => setList(d.songs)).catch(() => {});
  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, []);
  async function act(s: S, action: string) {
    const r = await fetch("/api/songs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id, action }) });
    if (!r.ok) toast("Couldn't update that one");
    load();
  }
  const live = list.filter((s) => s.status !== "played");
  if (!live.length) return null;
  const waiting = list.filter((s) => s.status === "pending").length;
  return (
    <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🎵 Song requests {waiting > 0 && <span className="branch-tag">{waiting} to check</span>}</h3>
      <ul className="song-admin">
        {live.map((s) => (
          <li key={s.id} className={s.status}>
            <span>
              <b>{s.status === "playing" ? "▶ " : ""}{s.title}</b>{s.artist && <span className="muted"> · {s.artist}</span>}{!!s.votes && <span className="tiny"> · ▲ {s.votes} vote{s.votes === 1 ? "" : "s"}</span>}
              <br /><span className="tiny muted">{s.name}{s.table_no ? ` · table ${s.table_no}` : ""} · {s.created_at.slice(11, 16)} · {s.status === "pending" ? "waiting for a yes" : s.status === "queued" ? "on the list" : "playing now"}</span>
            </span>
            <span className="row" style={{ gap: "0.3rem", flexWrap: "wrap" }}>
              {s.status === "pending" && <button className="chip on" onClick={() => act(s, "approve")}>Add to list</button>}
              {s.status !== "playing" && <button className="chip" onClick={() => act(s, "play")}>▶ Playing now</button>}
              {s.status === "playing" && <button className="chip" onClick={() => act(s, "done")}>✓ Done</button>}
              <button className="chip" onClick={() => act(s, "remove")}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
