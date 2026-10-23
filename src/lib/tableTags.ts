// Seat tags (socket, window, quiet, dog-friendly), saved as a setting so staff can change them.
import "server-only";
import { getSetting, setSetting } from "./db";
import { DEFAULT_TAGS, cleanTags, type SeatTag } from "./floor";

export function tableTags(): Record<number, SeatTag[]> {
  const raw = getSetting("table_tags");
  if (!raw) return DEFAULT_TAGS;
  try { return cleanTags(JSON.parse(raw)); } catch { return DEFAULT_TAGS; }
}
export function saveTableTags(v: unknown) {
  const tags = cleanTags(v);
  setSetting("table_tags", JSON.stringify(tags));
  return tags;
}
