// Where our coffee comes from, for the map at /origins. Places are real; the map is a sketch.
export type Origin = { id: string; name: string; state: string; lat: number; lon: number; altitude: string; taste: string; story: string; usedIn: string[]; /** where the map label sits */ label: "left" | "right" | "above" | "below" | "aboveRight" };

export const CAFE_SPOT = { lat: 15.49, lon: 73.83, name: "Moss & Moon, Panjim" };

export const ORIGINS: Origin[] = [
  { id: "chikmagalur", name: "Chikmagalur", state: "Karnataka", lat: 13.32, lon: 75.77, altitude: "1,000–1,500 m", taste: "Chocolate, caramel, a little spice", story: "Where Indian coffee began: Baba Budan is said to have planted seven beans here in the 1600s. Our House Blend starts here.", usedIn: ["house-blend-beans", "single-origin-beans", "americano"], label: "right" },
  { id: "coorg", name: "Coorg (Kodagu)", state: "Karnataka", lat: 12.42, lon: 75.74, altitude: "900–1,200 m", taste: "Bold, earthy, a hint of pepper", story: "India's biggest coffee district, grown in the shade of silver oaks with pepper vines climbing them.", usedIn: ["house-blend-beans", "filter-kaapi"], label: "left" },
  { id: "br-hills", name: "Biligiriranga Hills", state: "Karnataka", lat: 11.99, lon: 77.14, altitude: "1,200 m", taste: "Bright and citrusy", story: "Small estates on the edge of a tiger reserve. Lovely as a pour-over.", usedIn: ["pour-over"], label: "aboveRight" },
  { id: "wayanad", name: "Wayanad", state: "Kerala", lat: 11.68, lon: 76.13, altitude: "700–2,100 m", taste: "Nutty and full-bodied", story: "Mostly robusta, the gentle kick in our 18-hour cold brew.", usedIn: ["cold-brew", "cold-brew-bottle", "vietnamese-iced"], label: "left" },
  { id: "nilgiris", name: "Nilgiris", state: "Tamil Nadu", lat: 11.41, lon: 76.7, altitude: "1,000–1,800 m", taste: "Mild and floral", story: "The Blue Mountains, better known for tea. Their coffee is soft and easy.", usedIn: ["cappuccino"], label: "below" },
  { id: "pulney", name: "Pulney Hills", state: "Tamil Nadu", lat: 10.24, lon: 77.49, altitude: "1,000–2,000 m", taste: "Juicy and fruity", story: "Some of the highest coffee in India. Often the star of our Mystery Bean of the Month.", usedIn: ["mystery-beans"], label: "right" },
  { id: "shevaroys", name: "Shevaroy Hills", state: "Tamil Nadu", lat: 11.78, lon: 78.21, altitude: "1,300 m", taste: "Soft and sweet", story: "Old estates around Yercaud in the Eastern Ghats.", usedIn: ["flat-white"], label: "right" },
  { id: "araku", name: "Araku Valley", state: "Andhra Pradesh", lat: 18.33, lon: 82.87, altitude: "900–1,100 m", taste: "Fruity, almost wine-like", story: "Grown by Adivasi farming co-operatives, much of it organic. A guest pour-over favourite.", usedIn: ["pour-over", "coffee-flight"], label: "right" },
];

/** Things from further away that end up in your cup */
export const FROM_AFAR = [
  { what: "Assam tea", where: "Assam, India", for: "our chai", itemId: "chai" },
  { what: "Matcha", where: "Uji, Japan", for: "our matcha lattes", itemId: "matcha" },
  { what: "Saffron", where: "Pampore, Kashmir", for: "kahwa and the saffron pista latte", itemId: "kahwa" },
  { what: "Alphonso mangoes", where: "Ratnagiri, Maharashtra", for: "mango cold brew and lassi", itemId: "mango-smoothie" },
  { what: "Kokum", where: "the Konkan coast", for: "kokum soda and sol kadhi", itemId: "kokum-soda" },
];

// Map area: longitude 72–88°E, latitude 7.5–21.5°N
const W = 466, H = 420, LON0 = 72, LON1 = 88, LAT0 = 7.5, LAT1 = 21.5;
export const MAP_SIZE = { w: W, h: H };
export const project = (lat: number, lon: number) => ({ x: ((lon - LON0) / (LON1 - LON0)) * W, y: ((LAT1 - lat) / (LAT1 - LAT0)) * H });

/** A rough outline of peninsular India (lat, lon), clockwise from the north-west */
const COAST: [number, number][] = [
  [21.6, 72.6], [21.6, 87.0], [21.0, 86.9], [20.3, 86.6], [19.8, 85.8], [19.3, 84.9], [18.3, 84.0], [17.7, 83.3], [16.9, 82.3], [16.5, 81.7], [16.0, 81.15],
  [15.7, 80.4], [15.0, 80.1], [14.4, 80.15], [13.4, 80.3], [13.08, 80.29], [12.2, 80.05], [11.9, 79.85], [11.0, 79.85], [10.3, 79.85], [10.1, 79.3],
  [9.9, 79.1], [9.3, 79.2], [9.1, 78.6], [8.8, 78.15], [8.4, 77.9], [8.08, 77.55], [8.3, 77.1], [8.5, 76.9], [8.9, 76.6], [9.5, 76.3], [10.0, 76.25],
  [10.5, 76.0], [11.25, 75.77], [11.87, 75.35], [12.5, 74.98], [12.87, 74.84], [13.4, 74.7], [14.0, 74.5], [14.8, 74.12], [15.5, 73.8], [16.0, 73.45],
  [17.0, 73.3], [18.0, 72.95], [18.95, 72.82], [19.5, 72.75], [20.4, 72.83], [21.2, 72.7],
];
export const coastPath = () => COAST.map(([lat, lon], i) => { const p = project(lat, lon); return `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ") + " Z";
