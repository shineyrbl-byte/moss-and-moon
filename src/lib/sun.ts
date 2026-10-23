// Sunrise, sunset and golden hour, worked out on the spot (the "sunrise equation", good to a minute or two).
// Pure, so the page, server and tests share it.
export const CAFE_COORDS = { lat: 15.4989, lon: 73.8278 }; // Panaji, Goa

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const jdToMs = (jd: number) => (jd - 2440587.5) * 86400_000;

/** For a date (YYYY-MM-DD, local to the place): when the sun crosses an elevation, rising and setting (ms) */
function crossing(date: string, elevation: number, { lat, lon } = CAFE_COORDS) {
  const noonUtc = Date.parse(`${date}T12:00:00Z`) / 86400_000 + 2440587.5;
  const n = Math.round(noonUtc - 2451545.0 - 0.0008) + 0.0008;
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 0.0003 * Math.sin(rad(3 * M));
  const L = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + jStar + 0.0053 * Math.sin(rad(M)) - 0.0069 * Math.sin(rad(2 * L));
  const sinD = Math.sin(rad(L)) * Math.sin(rad(23.4397));
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(rad(elevation)) - Math.sin(rad(lat)) * sinD) / (Math.cos(rad(lat)) * cosD);
  if (cosW < -1 || cosW > 1) return null; // the sun never gets there that day
  const w = deg(Math.acos(cosW)) / 360;
  return { rise: jdToMs(transit - w), set: jdToMs(transit + w), noon: jdToMs(transit) };
}

/** The evening for one day: golden hour starts (sun 6° up), sunset, and dusk (6° down, the end of the blue hour) */
export function sunDay(date: string, at = CAFE_COORDS) {
  const s = crossing(date, -0.833, at)!, g = crossing(date, 6, at)!, d = crossing(date, -6, at)!;
  return { sunrise: s.rise, sunset: s.set, goldenStart: g.set, dusk: d.set, morningGoldenEnd: g.rise, noon: s.noon };
}

export const istClock = (ms: number) => new Date(ms + 5.5 * 3600_000).toISOString().slice(11, 16);
