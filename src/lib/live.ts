// In-memory "something changed" messages, pushed to open pages over SSE.
// (One server process, so a simple event emitter is all we need.)
import "server-only";
import { EventEmitter } from "node:events";

export type LiveEvent =
  | { type: "order"; code: string; status?: string; action: "new" | "status" | "paid" | "here" }
  | { type: "menu" }
  | { type: "call"; table: number; action: "new" | "done" }
  | { type: "group"; code: string }
  | { type: "notice" }
  | { type: "support"; code: string };

const g = globalThis as unknown as { __mmLive?: EventEmitter };
const bus = g.__mmLive ?? (g.__mmLive = new EventEmitter().setMaxListeners(1000));

export const publish = (e: LiveEvent) => bus.emit("event", e);

export function subscribe(fn: (e: LiveEvent) => void) {
  bus.on("event", fn);
  return () => bus.off("event", fn);
}
