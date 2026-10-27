// Shared geometry for square-grid puzzles: squares are numbered row by row from 0. Pure.
// Neighbour lists come in a fixed order (row by row, or up/down/left/right), so puzzles built from them stay the same.
export function makeGrid(rows: number, cols = rows) {
  const rowOf = (i: number) => Math.floor(i / cols), colOf = (i: number) => i % cols;
  const inside = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
  const at = (r: number, c: number) => r * cols + c;
  return {
    rows, cols, size: rows * cols, rowOf, colOf, inside, at,
    /** Up, down, left, right (the ones on the board) */
    side: (i: number) => [i - cols, i + cols, colOf(i) > 0 ? i - 1 : -1, colOf(i) < cols - 1 ? i + 1 : -1].filter((j) => j >= 0 && j < rows * cols),
    /** The 3×3 block around a square, itself included, row by row */
    block: (i: number) => { const out: number[] = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (inside(rowOf(i) + dr, colOf(i) + dc)) out.push(at(rowOf(i) + dr, colOf(i) + dc)); return out; },
    /** The up to eight squares touching this one (corners too), row by row */
    around: (i: number) => { const out: number[] = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && inside(rowOf(i) + dr, colOf(i) + dc)) out.push(at(rowOf(i) + dr, colOf(i) + dc)); return out; },
    /** Two different squares that touch, corners included */
    touching: (a: number, b: number) => a !== b && Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1,
    /** Two squares side by side (not corners) */
    beside: (a: number, b: number) => Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1,
  };
}
