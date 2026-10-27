// Game settings kept on this device: sound, vibration, colour-blind patterns and screen-reader help. Browser only.
export const SETTINGS_KEY = "mm-game-settings";
export type BoardTheme = "cafe" | "contrast" | "garden" | "night";
/** Board looks for every puzzle grid, board game and card game at once (they change colours, nothing else) */
export const BOARD_THEMES: { id: BoardTheme; name: string; how: string; swatch: [string, string, string] }[] = [
  { id: "cafe", name: "Café", how: "The usual cream and pink, following light or dark mode", swatch: ["#fffaf6", "#f9dce3", "#c25b78"] },
  { id: "contrast", name: "High contrast", how: "White squares, black lines and bright yellow for where you are", swatch: ["#ffffff", "#ffe14d", "#000000"] },
  { id: "garden", name: "Garden", how: "Soft greens, easy on the eyes", swatch: ["#f4f8ef", "#d9ead0", "#4f7a52"] },
  { id: "night", name: "Night", how: "Deep blue boards, even in light mode", swatch: ["#1f2433", "#3b3f66", "#9fb4ff"] },
];
export const isBoardTheme = (v: unknown): v is BoardTheme => BOARD_THEMES.some((t) => t.id === v);
export type GameSettings = { sound: boolean; vibrate: boolean; patterns: boolean; reader: boolean; zen: boolean; board: BoardTheme };
export const DEFAULTS: GameSettings = { sound: true, vibrate: false, patterns: false, reader: false, zen: false, board: "cafe" };
export function gameSettings(): GameSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") }; } catch { return DEFAULTS; }
}
export function saveGameSettings(s: GameSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
  if (s.patterns) document.documentElement.dataset.patterns = "on"; else delete document.documentElement.dataset.patterns;
  if (s.reader) document.documentElement.dataset.reader = "on"; else delete document.documentElement.dataset.reader;
  if (s.zen) document.documentElement.dataset.zen = "on"; else delete document.documentElement.dataset.zen;
  if (s.board !== "cafe" && isBoardTheme(s.board)) document.documentElement.dataset.board = s.board; else delete document.documentElement.dataset.board;
}
/** A short buzz, if vibration is on and the phone can */
export function buzz(ms: number | number[] = 25) {
  try { if (gameSettings().vibrate) navigator.vibrate?.(ms); } catch {}
}
