// "Where are you visiting from?": Indian states and union territories, and countries.
export const STATES = [
  "Andaman & Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
export const COUNTRIES = [
  "Australia", "Austria", "Bangladesh", "Belgium", "Brazil", "Canada", "China", "Denmark", "Finland", "France", "Germany",
  "Greece", "Indonesia", "Iran", "Ireland", "Israel", "Italy", "Japan", "Kenya", "Malaysia", "Maldives", "Mexico", "Nepal",
  "Netherlands", "New Zealand", "Nigeria", "Norway", "Poland", "Portugal", "Qatar", "Russia", "Saudi Arabia", "Singapore",
  "South Africa", "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Thailand", "Turkey", "UAE", "Ukraine",
  "United Kingdom", "United States", "Vietnam", "Another country",
];
export type Place = { name: string; kind: "state" | "country" };
export function placeFor(v: unknown): Place | null {
  const s = String(v ?? "");
  if (STATES.includes(s)) return { name: s, kind: "state" };
  if (COUNTRIES.includes(s)) return { name: s, kind: "country" };
  return null;
}
