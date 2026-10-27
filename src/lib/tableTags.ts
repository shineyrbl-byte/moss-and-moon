// Seat tags (socket, window, quiet, dog-friendly), saved as a setting so staff can change them.
// Guests only see tags once someone at the café has saved them: the starting ones are suggestions, not facts.
import "server-only";
import { getSetting, setSetting } from "./db";
import { DEFAULT_TAGS, cleanTags, type SeatTag } from "./floor";

const saved = (): Record<number, SeatTag[]> | null => {
  const raw = getSetting("table_tags");
  if (!raw) return null;
  try { return cleanTags(JSON.parse(raw)); } catch { return null; }
};
/** What guests see: the saved tags, or none yet */
export const tableTags = (): Record<number, SeatTag[]> => saved() ?? cleanTags({});
/** For the staff card: the saved tags, or the suggestions to start from (and whether they've been saved) */
export const tagsForStaff = () => { const s = saved(); return { tags: s ?? DEFAULT_TAGS, saved: !!s }; };
export function saveTableTags(v: unknown) {
  const tags = cleanTags(v);
  setSetting("table_tags", JSON.stringify(tags));
  return tags;
}
