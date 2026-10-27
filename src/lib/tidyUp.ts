// Clears out old rows nobody will look at again, once a day (the rules are in tidyRules.ts)
import "server-only";
import { db, getSetting, setSetting } from "./db";
import { toDateStr } from "./cafe";
import { tidyRows } from "./tidyRules";

export const tidyUp = (now = new Date()) => tidyRows(db, now);
/** Run once a day */
export function tidyTick(now = new Date()) {
  const today = toDateStr(now);
  if (getSetting("tidy_last") === today) return null;
  setSetting("tidy_last", today);
  return tidyUp(now);
}
