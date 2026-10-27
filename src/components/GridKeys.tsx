"use client";
import { useEffect } from "react";
import { gameSettings } from "@/lib/gameSettings";

const columns = (grid: Element) => Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);

/**
 * Keyboard and screen-reader help for every puzzle grid (anything with role="grid"), mounted once for the whole site:
 * - arrow keys move between squares, Home/End jump to the row's ends (grids with data-own-keys handle keys themselves)
 * - with screen-reader mode on, a grid is a single Tab stop: Tab leaves it instead of visiting every square
 */
export default function GridKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null, grid = el?.closest?.("[role=grid]");
      if (!el || !grid || grid.hasAttribute("data-own-keys") || e.metaKey || e.ctrlKey || e.altKey) return;
      const cells = [...grid.querySelectorAll<HTMLElement>("button, [role=gridcell][tabindex]")];
      const i = cells.indexOf(el);
      if (i < 0) return;
      const cols = columns(grid), row = Math.floor(i / cols);
      let j: number | null = null;
      if (e.key === "ArrowRight") j = i + 1; else if (e.key === "ArrowLeft") j = i - 1;
      else if (e.key === "ArrowDown") j = i + cols; else if (e.key === "ArrowUp") j = i - cols;
      else if (e.key === "Home") j = row * cols; else if (e.key === "End") j = Math.min(cells.length - 1, row * cols + cols - 1);
      else if (e.key === "Tab" && gameSettings().reader) {
        // Jump past the rest of the grid, to the next thing you can reach outside it
        const all = [...document.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((x) => x.offsetParent !== null);
        const out = e.shiftKey ? all.filter((x) => !grid.contains(x) && (x.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING)) : all.filter((x) => !grid.contains(x) && (grid.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING));
        const target = e.shiftKey ? out[out.length - 1] : out[0];
        if (target) { e.preventDefault(); target.focus(); }
        return;
      }
      if (j === null) return;
      e.preventDefault();
      cells[Math.max(0, Math.min(cells.length - 1, j))]?.focus();
    };
    document.addEventListener("keydown", onKey);
    if (gameSettings().reader) document.documentElement.dataset.reader = "on";
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
