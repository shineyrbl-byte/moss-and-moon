// Blind date with a book: hints are kept in settings; titles are only sent once you unwrap one.
import "server-only";
import { getSetting, setSetting } from "./db";
import { shelf } from "./library";
import { DEFAULT_HINTS, cleanHints } from "./blindDate";

function allHints(): Record<string, string[]> {
  try { return { ...DEFAULT_HINTS, ...JSON.parse(getSetting("blind_hints") ?? "{}") }; } catch { return { ...DEFAULT_HINTS }; }
}
const books = () => shelf().filter((i) => i.kind === "book");

/** Wrapped books: hints and whether it's out, no titles */
export function parcels() {
  const h = allHints();
  return books().filter((b) => (h[b.id] ?? []).length > 0).map((b) => ({ id: b.id, hints: h[b.id], out: !!b.out }));
}
export function unwrap(id: unknown) {
  const b = books().find((x) => x.id === id);
  return b && (allHints()[b.id] ?? []).length ? { id: b.id, title: b.title, author: b.detail, out: !!b.out } : null;
}
/** Owner: every book with its hints (empty = not wrapped) */
export const hintsForOwner = () => { const h = allHints(); return books().map((b) => ({ id: b.id, title: b.title, hints: h[b.id] ?? [] })); };
export function saveHints(id: unknown, hints: unknown) {
  if (!books().some((b) => b.id === id)) return { error: "Pick a book from the shelf." };
  let saved: Record<string, string[]> = {};
  try { saved = JSON.parse(getSetting("blind_hints") ?? "{}"); } catch {}
  saved[id as string] = cleanHints(hints); // an empty list unwraps it from the blind-date shelf
  setSetting("blind_hints", JSON.stringify(saved));
  return { ok: true, books: hintsForOwner() };
}
