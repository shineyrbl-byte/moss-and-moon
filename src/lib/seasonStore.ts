// Which season the site is dressed for right now (server side)
import "server-only";
import { getSetting } from "./db";
import { activeSeason, isSeasonSetting, type SeasonSetting } from "./seasons";

export function seasonSetting(): SeasonSetting {
  const v = getSetting("season");
  return isSeasonSetting(v) ? v : "auto";
}

export const currentSeason = () => activeSeason(seasonSetting());
