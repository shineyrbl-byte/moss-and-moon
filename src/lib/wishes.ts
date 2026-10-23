// The wish tree: tie a wish to the tree; on each full moon it lets them all go and starts again.
export const WISH_MAX = 120;
export const RIBBONS = ["#f2a7b8", "#f6c667", "#9cc98a", "#8fc1e3", "#b79ad6", "#f08a4b"];
/** Where ribbon number n hangs on the tree (in a 400×300 drawing), spread over the branches */
export function ribbonSpot(n: number) {
  const branches = [[90, 120], [140, 85], [200, 70], [260, 85], [310, 120], [120, 150], [280, 150], [170, 110], [230, 110], [200, 140]];
  const [bx, by] = branches[n % branches.length];
  const ring = Math.floor(n / branches.length);
  return { x: bx + ((ring * 23) % 40) - 20, y: by + ((ring * 17) % 26) - 13 };
}
