// I spy: things for kids to find around the café. Owners can change the list in Admin → Notices.
export const ISPY_DEFAULT = [
  "🌸 Something pink",
  "🌿 A plant with big leaves",
  "🎲 The shelf of board games",
  "❤️ A heart drawn in milk foam",
  "🌙 Something shaped like a moon",
  "📕 A book with a blue cover",
  "♨️ Steam rising from a cup",
  "🕰 A clock",
  "🖍 A crayon",
  "🥄 A tiny spoon",
  "🪟 A window with the sun coming in",
  "😊 Someone smiling at you",
];
export const ISPY_MAX = 16;
/** Up to 16 short lines, blanks dropped */
export const cleanSpy = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").replace(/[<>]/g, "").trim().slice(0, 50)).filter(Boolean).slice(0, ISPY_MAX);
