// Colouring pages for kids: simple line drawings made of shapes you tap to fill.
// 200×200 drawings. `areas` can be coloured; `lines` are just outlines (steam, whiskers).
export type ColourPage = { id: string; title: string; areas: { id: string; d: string }[]; lines?: string[] };

const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 Z`;
function star(cx: number, cy: number, r: number) {
  const pts = [...Array(10).keys()].map((i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
  });
  return `M${pts.join(" L")} Z`;
}
const BG = "M0,0 H200 V200 H0 Z";

export const COLOUR_PAGES: ColourPage[] = [
  {
    id: "latte", title: "A latte with a heart",
    areas: [
      { id: "bg", d: BG },
      { id: "saucer", d: ellipse(100, 162, 72, 16) },
      { id: "handle", d: "M146,102 q32,-2 28,26 q-4,22 -34,18 l2,-11 q20,3 21,-9 q2,-15 -19,-13 Z" },
      { id: "cup", d: "M50,92 L150,92 L140,156 Q100,172 60,156 Z" },
      { id: "coffee", d: ellipse(100, 92, 50, 10) },
      { id: "heart", d: "M100,99 c-7,-8 -17,-3 -12,4 l12,7 l12,-7 c5,-7 -5,-12 -12,-4 Z" },
      { id: "spot1", d: ellipse(80, 128, 5, 5) },
      { id: "spot2", d: ellipse(100, 136, 5, 5) },
      { id: "spot3", d: ellipse(120, 128, 5, 5) },
    ],
    lines: ["M82,74 q-8,-11 0,-22 q8,-11 0,-22", "M100,72 q-8,-11 0,-22 q8,-11 0,-22", "M118,74 q-8,-11 0,-22 q8,-11 0,-22"],
  },
  {
    id: "moon", title: "The moon and stars",
    areas: [
      { id: "bg", d: BG },
      { id: "moon", d: "M118,30 a60,60 0 1,0 48,104 a50,50 0 1,1 -48,-104 Z" },
      { id: "s1", d: star(40, 40, 14) },
      { id: "s2", d: star(165, 40, 10) },
      { id: "s3", d: star(150, 165, 12) },
      { id: "s4", d: star(30, 110, 9) },
      { id: "cloud", d: "M28,170 q0,-20 20,-20 q5,-16 26,-12 q15,-11 29,5 q21,0 21,18 q0,12 -15,12 h-66 q-15,0 -15,-3 Z" },
    ],
  },
  {
    id: "pup", title: "A pup with a pup cup",
    areas: [
      { id: "bg", d: BG },
      { id: "ear-l", d: "M66,58 q-30,8 -24,54 q16,6 27,-17 Z" },
      { id: "ear-r", d: "M134,58 q30,8 24,54 q-16,6 -27,-17 Z" },
      { id: "head", d: ellipse(100, 92, 42, 40) },
      { id: "patch", d: "M112,62 q22,2 24,26 q-12,8 -24,-4 Z" },
      { id: "muzzle", d: ellipse(100, 110, 20, 14) },
      { id: "nose", d: "M91,102 q9,-7 18,0 q-9,9 -18,0 Z" },
      { id: "eye-l", d: ellipse(84, 86, 5, 6) },
      { id: "eye-r", d: ellipse(116, 86, 5, 6) },
      { id: "cup", d: "M74,150 h52 l-7,40 h-38 Z" },
      { id: "cream", d: "M72,150 q6,-15 15,-8 q8,-13 19,-2 q10,-8 18,7 q3,3 1,3 Z" },
      { id: "biscuit", d: "M112,138 h14 a4,4 0 1,1 0,6 h-14 a4,4 0 1,1 0,-6 Z" },
    ],
    lines: ["M100,117 q-6,6 -12,2", "M100,117 q6,6 12,2"],
  },
  {
    id: "plant", title: "A plant in a pot",
    areas: [
      { id: "bg", d: BG },
      { id: "sun", d: ellipse(40, 40, 18, 18) },
      { id: "leaf-l", d: "M100,122 C68,112 52,82 68,54 C90,70 100,96 100,122 Z" },
      { id: "leaf-r", d: "M100,122 C132,112 148,82 132,54 C110,70 100,96 100,122 Z" },
      { id: "leaf-m", d: "M100,120 C89,90 91,54 100,32 C109,54 111,90 100,120 Z" },
      { id: "pot", d: "M66,128 h68 l-10,58 h-48 Z" },
      { id: "rim", d: "M60,118 h80 v13 h-80 Z" },
      { id: "dot1", d: ellipse(88, 156, 5, 5) },
      { id: "dot2", d: ellipse(112, 156, 5, 5) },
    ],
    lines: ["M40,12 v-8", "M40,76 v-8", "M12,40 h-8", "M76,40 h-8", "M60,20 l5,-5", "M20,60 l-5,5", "M60,60 l5,5", "M20,20 l-5,-5"],
  },
];

export const CRAYONS = ["#f2a7b8", "#c25b78", "#f6c667", "#f08a4b", "#9cc98a", "#5f6f4e", "#8fc1e3", "#3e6fa8", "#b79ad6", "#a0715a", "#3b2a24", "#ffffff"];
