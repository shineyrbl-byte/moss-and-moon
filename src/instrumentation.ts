import type { Instrumentation } from "next";

// Runs once when the server starts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadConfig } = await import("@/lib/cafeConfig");
    loadConfig(); // opening hours, holidays and golden hour
    const { startJobs } = await import("@/lib/jobs");
    startJobs();
  }
}

// Any error while rendering a page or running an API route ends up here
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/lib/errors");
  const e = err instanceof Error ? err : new Error(String(err));
  reportError("server", e.message, `${request.method} ${request.path}\nroute: ${context.routePath} (${context.routeType})\n${e.stack ?? ""}`);
};
