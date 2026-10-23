// The secret menu: five small moons are hidden around the site. Find them all to unlock it.
export const MOONS = [
  { id: "m-footer-7k", where: "footer", hint: "At the very bottom, where every page ends." },
  { id: "m-colour-2q", where: "colouring", hint: "In a picture waiting for crayons." },
  { id: "m-trivia-9x", where: "trivia", hint: "Behind today's answer, once you've given yours." },
  { id: "m-plants-4f", where: "plants", hint: "Hiding among the leaves." },
  { id: "m-nearby-6w", where: "nearby", hint: "Just around the corner." },
] as const;
export type MoonId = (typeof MOONS)[number]["id"];
export const MOONS_KEY = "mm-moons";

/** The valid moons in a list, with no repeats */
export const cleanFound = (v: unknown) => (Array.isArray(v) ? MOONS.filter((m) => v.includes(m.id)).map((m) => m.id) : []);
export const allFound = (v: unknown) => cleanFound(v).length === MOONS.length;
