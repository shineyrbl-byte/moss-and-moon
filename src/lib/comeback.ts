// "Bring it back": each month guests vote for one retired drink or bake; the winner returns the next month.
export const COMEBACK_MIN = 3; // votes a winner needs
export const monthOf = (date: string) => date.slice(0, 7);
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + by;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export const monthLabel = (month: string) => new Date(`${month}-15T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
