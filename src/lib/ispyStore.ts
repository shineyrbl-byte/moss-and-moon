import "server-only";
import { getSetting, setSetting } from "./db";
import { cleanSpy, ISPY_DEFAULT } from "./ispy";

export function ispyList() {
  try { const l = cleanSpy(JSON.parse(getSetting("ispy_items") ?? "null")); return l.length ? l : ISPY_DEFAULT; } catch { return ISPY_DEFAULT; }
}
/** Owners: a new list (empty puts ours back) */
export function saveIspy(v: unknown) {
  const l = cleanSpy(v);
  setSetting("ispy_items", l.length ? JSON.stringify(l) : "");
  return l.length ? l : ISPY_DEFAULT;
}
