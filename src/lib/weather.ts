// Today's weather at the café (Panjim) from Open-Meteo (free, no key), kept for 20 minutes.
// WEATHER=off turns it off; WEATHER=fake gives a fixed rainy day for tests.
import "server-only";
import type { Weather } from "./weatherPicks";

const CAFE = { lat: 15.4989, lon: 73.8278 };
const KEEP_MS = 20 * 60_000;
const g = globalThis as { __mmWeather?: { at: number; w: Weather | null } };

export async function currentWeather(): Promise<Weather | null> {
  if (process.env.WEATHER === "off") return null;
  if (process.env.WEATHER === "fake") return { temp: 26, code: 63, isDay: true };
  if (g.__mmWeather && Date.now() - g.__mmWeather.at < KEEP_MS) return g.__mmWeather.w;
  let w: Weather | null = null;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CAFE.lat}&longitude=${CAFE.lon}&current=temperature_2m,weather_code,is_day&timezone=Asia%2FKolkata`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    const j = await r.json();
    const c = j?.current;
    if (r.ok && typeof c?.temperature_2m === "number") w = { temp: Math.round(c.temperature_2m), code: Number(c.weather_code) || 0, isDay: c.is_day !== 0 };
  } catch {}
  // Remember failures too (for 5 minutes), so a down weather service doesn't slow every page
  g.__mmWeather = { at: w ? Date.now() : Date.now() - KEEP_MS + 5 * 60_000, w };
  return w;
}
