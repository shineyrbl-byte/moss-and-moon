// Game settings kept on this device: sound, vibration and colour-blind patterns. Browser only.
export const SETTINGS_KEY = "mm-game-settings";
export type GameSettings = { sound: boolean; vibrate: boolean; patterns: boolean };
export const DEFAULTS: GameSettings = { sound: true, vibrate: false, patterns: false };
export function gameSettings(): GameSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") }; } catch { return DEFAULTS; }
}
export function saveGameSettings(s: GameSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
  if (s.patterns) document.documentElement.dataset.patterns = "on"; else delete document.documentElement.dataset.patterns;
}
/** A short buzz, if vibration is on and the phone can */
export function buzz(ms: number | number[] = 25) {
  try { if (gameSettings().vibrate) navigator.vibrate?.(ms); } catch {}
}
