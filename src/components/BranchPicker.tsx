"use client";
import { activeBranches } from "@/lib/cafe";
import { useStore } from "./Store";

/** "Which café?" chips. Shows nothing while there's only one café. */
export default function BranchPicker({ label = "Which café?", onChange }: { label?: string; onChange?: (id: string) => void }) {
  const { branch, setBranch, table } = useStore();
  const list = activeBranches();
  if (list.length < 2 || table) return null;
  return (
    <div className="field">
      <span>{label}</span>
      <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label={label}>
        {list.map((b) => (
          <button type="button" key={b.id} role="radio" aria-checked={branch === b.id} className={`chip ${branch === b.id ? "on" : ""}`} onClick={() => { setBranch(b.id); onChange?.(b.id); }}>
            {b.name}{b.address && <small className="muted" style={{ marginLeft: "0.3rem" }}>{b.address}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}
