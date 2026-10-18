// Whole cakes ordered ahead, with a message on top
export type CakeSize = { id: string; label: string; price: number };
export type WholeCake = { itemId: string; sizes: CakeSize[]; message: boolean };

export const CAKE_LEAD_DAYS = 2;
export const CAKES_PER_DAY = 8;
export const CAKE_MESSAGE_MAX = 30;

export const WHOLE_CAKES: WholeCake[] = [
  { itemId: "pink-velvet", message: true, sizes: [{ id: "half", label: "½ kg · serves 6", price: 1100 }, { id: "one", label: "1 kg · serves 12", price: 1950 }] },
  { itemId: "fudge-cake", message: true, sizes: [{ id: "half", label: "½ kg · serves 6", price: 1150 }, { id: "one", label: "1 kg · serves 12", price: 2050 }] },
  { itemId: "cheesecake", message: true, sizes: [{ id: "half", label: "½ kg · serves 6", price: 1300 }, { id: "one", label: "1 kg · serves 12", price: 2400 }] },
  { itemId: "raspberry-almond-cake", message: true, sizes: [{ id: "half", label: "½ kg · serves 6 (gluten-free)", price: 1400 }] },
  { itemId: "tiramisu", message: false, sizes: [{ id: "tray", label: "Party tray · serves 8", price: 1600 }] },
  { itemId: "bebinca", message: false, sizes: [{ id: "half", label: "½ kg slab · serves 8", price: 950 }, { id: "one", label: "1 kg slab · serves 16", price: 1800 }] },
];
export const wholeCake = (itemId: string) => WHOLE_CAKES.find((c) => c.itemId === itemId);
