"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "./Store";

type Comfort = { text: "normal" | "large"; motion: "normal" | "reduce" };

/** Apply the saved choices to the page (also done before first paint, in the layout) */
function apply(c: Comfort) {
  const el = document.documentElement;
  if (c.text === "large") el.dataset.text = "large"; else delete el.dataset.text;
  if (c.motion === "reduce") el.dataset.motion = "reduce"; else delete el.dataset.motion;
}

/** "Aa": bigger text and calmer motion, remembered on this device */
export default function ComfortMenu() {
  const { t } = useStore();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState<Comfort>({ text: "normal", motion: "normal" });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = document.documentElement;
    setC({ text: el.dataset.text === "large" ? "large" : "normal", motion: el.dataset.motion === "reduce" ? "reduce" : "normal" });
  }, []);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  const set = (next: Comfort) => {
    setC(next);
    apply(next);
    try { localStorage.setItem("mm-comfort", JSON.stringify(next)); } catch {}
  };
  return (
    <div className="comfort" ref={box}>
      <button className={`icon-btn ${c.text === "large" || c.motion === "reduce" ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("comfort.title")} title={t("comfort.title")}>
        <span aria-hidden style={{ fontWeight: 700 }}>Aa</span>
      </button>
      {open && (
        <div className="comfort-pop card" role="group" aria-label={t("comfort.title")}>
          <strong className="small">{t("comfort.title")}</strong>
          <div className="toggle-row">
            <span>{t("comfort.large")}</span>
            <button className={`switch ${c.text === "large" ? "" : "off"}`} aria-pressed={c.text === "large"} aria-label={t("comfort.large")} onClick={() => set({ ...c, text: c.text === "large" ? "normal" : "large" })} />
          </div>
          <div className="toggle-row">
            <span>{t("comfort.motion")}</span>
            <button className={`switch ${c.motion === "reduce" ? "" : "off"}`} aria-pressed={c.motion === "reduce"} aria-label={t("comfort.motion")} onClick={() => set({ ...c, motion: c.motion === "reduce" ? "normal" : "reduce" })} />
          </div>
          <small className="muted">{t("comfort.saved")}</small>
        </div>
      )}
    </div>
  );
}
