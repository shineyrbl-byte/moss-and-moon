// The café floor plan: tables guests can pick when they book.
// Numbers match the QR codes on the tables, so a pre-order lands on the right one.
export type FloorTable = { no: number; seats: number; zone: string; x: number; y: number; w: number; h: number; round?: boolean };

export const FLOOR: FloorTable[] = [
  { no: 1, seats: 2, zone: "Window", x: 6, y: 8, w: 15, h: 14, round: true },
  { no: 2, seats: 2, zone: "Window", x: 27, y: 8, w: 15, h: 14, round: true },
  { no: 3, seats: 4, zone: "Window", x: 48, y: 8, w: 22, h: 16 },
  { no: 4, seats: 2, zone: "Garden", x: 80, y: 8, w: 15, h: 14, round: true },
  { no: 5, seats: 4, zone: "Middle", x: 8, y: 42, w: 22, h: 16 },
  { no: 6, seats: 4, zone: "Middle", x: 38, y: 42, w: 22, h: 16 },
  { no: 7, seats: 8, zone: "Sofa corner", x: 68, y: 40, w: 27, h: 22 },
  { no: 8, seats: 2, zone: "By the books", x: 8, y: 74, w: 15, h: 14, round: true },
];
/** The counter, drawn for orientation (percent of the plan) */
export const COUNTER = { x: 32, y: 76, w: 40, h: 14 };

export const floorTable = (no: number) => FLOOR.find((t) => t.no === no);
/** Bookings this many minutes apart or closer can't share a table */
export const TABLE_GAP = 90;
export const PREORDER_LEAD = 15;
