// Delivery jam: slide the crates (each only along its length) to get the cake van out through the gap on the right.
// Boards are 36 letters, row by row: A is the van, other letters are crates, "." is empty. Pure, so the page and tests share it.
export const N = 6;
export const EXIT_ROW = 2;
export type Piece = { id: string; r: number; c: number; len: number; across: boolean };
export type Level = { board: string; fewest: number };

export function parse(board: string): Piece[] {
  const out: Piece[] = [];
  const seen = new Set<string>();
  [...board].forEach((ch, i) => {
    if (ch === "." || seen.has(ch)) return;
    seen.add(ch);
    const cells = [...board].flatMap((x, j) => (x === ch ? [j] : []));
    const r = Math.floor(cells[0] / N), c = cells[0] % N;
    out.push({ id: ch, r, c, len: cells.length, across: cells.length > 1 && cells[1] === cells[0] + 1 });
    void i;
  });
  return out;
}
export function encode(ps: Piece[]): string {
  const g = Array(N * N).fill(".");
  for (const p of ps) for (let k = 0; k < p.len; k++) g[(p.r + (p.across ? 0 : k)) * N + p.c + (p.across ? k : 0)] = p.id;
  return g.join("");
}
const filled = (ps: Piece[], skip = -1) => {
  const g = Array(N * N).fill(false);
  ps.forEach((p, i) => { if (i !== skip) for (let k = 0; k < p.len; k++) g[(p.r + (p.across ? 0 : k)) * N + p.c + (p.across ? k : 0)] = true; });
  return g;
};
/** How far piece i can slide back (negative) and forward (positive) */
export function range(ps: Piece[], i: number): [number, number] {
  const g = filled(ps, i), p = ps[i];
  const free = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N && !g[r * N + c];
  let lo = 0, hi = 0;
  if (p.across) { while (free(p.r, p.c + lo - 1)) lo--; while (free(p.r, p.c + p.len + hi)) hi++; }
  else { while (free(p.r + lo - 1, p.c)) lo--; while (free(p.r + p.len + hi, p.c)) hi++; }
  return [lo, hi];
}
export function slide(ps: Piece[], i: number, by: number): Piece[] | null {
  const [lo, hi] = range(ps, i);
  if (!by || by < lo || by > hi) return null;
  return ps.map((p, j) => (j === i ? (p.across ? { ...p, c: p.c + by } : { ...p, r: p.r + by }) : p));
}
export const van = (ps: Piece[]) => ps.find((p) => p.id === "A")!;
export const isOut = (ps: Piece[]) => van(ps).c + van(ps).len === N;

/** Fewest slides to get the van out (a slide is one crate, any distance), or null */
export function solve(board: string): number | null {
  let frontier = [board];
  const seen = new Set(frontier);
  for (let d = 0; frontier.length; d++) {
    const next: string[] = [];
    for (const b of frontier) {
      const ps = parse(b);
      if (isOut(ps)) return d;
      ps.forEach((_, i) => {
        const [lo, hi] = range(ps, i);
        for (let by = lo; by <= hi; by++) {
          if (!by) continue;
          const k = encode(slide(ps, i, by)!);
          if (!seen.has(k)) { seen.add(k); next.push(k); }
        }
      });
    }
    frontier = next;
  }
  return null;
}

// Each one is the hardest start for its set of crates (found by working back from every way out), checked with solve()
export const LEVELS: Level[] = [
  { board: "..CC..FEEG..FAAG..F..DDD......BBHHII", fewest: 3 },
  { board: ".DD.....EFFFAAE..I.GBB.ICG....C.HH..", fewest: 4 },
  { board: "..B...CCBEFIAABEFI...GDDH..G..H..G..", fewest: 5 },
  { board: "H..DD.HGGEEEH.AA.CF..I.CF..IBB......", fewest: 6 },
  { board: ".CC.G.....GB..AADB...EDIH..EDIH..EFF", fewest: 7 },
  { board: ".DDF.....FII.GAAEC.GB.EC..BHH.......", fewest: 8 },
  { board: "..CCG.....G..AABF.DDHBF...HBII..HEE.", fewest: 9 },
  { board: ".HGGB..H..BE..AABE...F....DFII..DCC.", fewest: 10 },
  { board: "BKJJEEBKNFFFAAN..LODDGGLO..ICMHH.ICM", fewest: 11 },
  { board: "HCFFDDHC.EEMHAA.OMNNLLO.IIJJJGKKBB.G", fewest: 12 },
  { board: "GHMMLLGHOOCCAA.I..DDDI..KFFEEJKBBNNJ", fewest: 13 },
  { board: "O..FGGOBBFI.JKAAICJK.MMC.KDDHLNNEEHL", fewest: 14 },
  { board: "OOEEEFCCGGBFAAMHBJLKMHBJLKI...NNIDD.", fewest: 15 },
  { board: "I.EEOOIDDFFFAAGKBJNHGKBJNH.K.CLLMM.C", fewest: 16 },
  { board: ".MMHHCFFIDECAAIDE...BDJJ..BKKL.NNGGL", fewest: 17 },
  { board: "L..EEEL.CCMIAAJGMIDDJGHHKKBBBOFFNNNO", fewest: 18 },
  { board: ".LGGGHOLFF.HOAANJDCCENJDM.EIIIM.BBKK", fewest: 20 },
  { board: "KLLFJ.KHHFJ.AAD..BGGD..BCCCMM.EEEII.", fewest: 22 },
  { board: "FG..JJFG.EEBFGAACBDDMLCB..MLII.HHKK.", fewest: 25 },
  { board: "IIKEEFMMK..FLCAADHLCBBDHLC.GD....GJJ", fewest: 31 },
];
