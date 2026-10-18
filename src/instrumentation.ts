// Runs once when the server starts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDemoBarista } = await import("@/lib/orderFlow");
    startDemoBarista();
  }
}
