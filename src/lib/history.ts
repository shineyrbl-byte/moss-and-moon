// Orders placed from this browser, so guests can see them again and re-order.
export type PastOrder = { code: string; at: string };
const KEY = "mm-orders";

export function getHistory(): PastOrder[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function rememberOrder(code: string) {
  try {
    const list = [{ code, at: new Date().toISOString() }, ...getHistory().filter((o) => o.code !== code)].slice(0, 30);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}
