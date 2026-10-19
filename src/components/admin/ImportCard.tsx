"use client";
import { useState } from "react";
import { useStore } from "../Store";
import { parseCsv } from "@/lib/csv";

type Result = { added: number; updated?: number; skipped: number; subscribed?: number; problems: string[]; dryRun: boolean };

const HELP = {
  guests: "Columns: name, phone, email, stamps (optional), newsletter (yes/no: only “yes” joins the newsletter).",
  menu: "Columns: name, category (coffee, tea, cold, food, bakes or shop), price, description, vegan (yes/no). Items come in hidden until you add a photo.",
};

/** Owner, Settings: bring in a guest list or a menu from a spreadsheet */
export default function ImportCard() {
  const { toast } = useStore();
  const [kind, setKind] = useState<"guests" | "menu">("guests");
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [file, setFile] = useState("");
  const [check, setCheck] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(dryRun: boolean) {
    setBusy(true);
    const r = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, rows, dryRun }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    setCheck(d);
    if (!dryRun) { toast(`Imported ${d.added}${d.updated ? ` (+${d.updated} updated)` : ""} ✓`); setRows(null); setFile(""); }
  }
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
      <h3 style={{ fontSize: "1.2rem" }}>📥 Import from a spreadsheet</h3>
      <p className="small muted">In Excel: File → Save as → CSV. In Google Sheets: File → Download → CSV. The first row should be the column names.</p>
      <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="What to import">
        {(["guests", "menu"] as const).map((k) => <button key={k} role="radio" aria-checked={kind === k} className={`chip ${kind === k ? "on" : ""}`} onClick={() => { setKind(k); setCheck(null); }}>{k === "guests" ? "Guest list" : "Menu items"}</button>)}
      </div>
      <p className="small">{HELP[kind]}</p>
      <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
        {file || "Choose a CSV file"}
        <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 2_000_000) return toast("That file is over 2 MB. Split it into smaller ones?");
          const parsed = parseCsv(await f.text());
          setFile(f.name); setRows(parsed); setCheck(null);
          if (!parsed.length) toast("No rows found in that file.");
        }} />
      </label>
      {rows && rows.length > 0 && (
        <>
          <p className="small muted" style={{ marginTop: "0.6rem" }}>{rows.length} row{rows.length === 1 ? "" : "s"} · columns: {Object.keys(rows[0]).join(", ")}</p>
          <div className="row" style={{ gap: "0.4rem" }}>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => send(true)}>Check it first</button>
            <button className="btn btn-pink btn-sm" disabled={busy} onClick={() => send(false)}>Import {rows.length}</button>
          </div>
        </>
      )}
      {check && (
        <div className="small" style={{ marginTop: "0.6rem" }}>
          <p>{check.dryRun ? "Would add" : "Added"} <b>{check.added}</b>{check.updated ? `, updated ${check.updated}` : ""}{check.subscribed ? `, ${check.subscribed} to the newsletter` : ""}{check.skipped ? `, skipped ${check.skipped}` : ""}.</p>
          {check.problems.length > 0 && <ul className="muted">{check.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}
