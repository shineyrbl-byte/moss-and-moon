"use client";
import { useEffect } from "react";
import { reportBrowserError } from "@/components/ErrorReporter";

// Last-resort error screen (when even the main layout fails)
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportBrowserError(error.message || "App crashed", error.stack ?? "");
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6eee7", color: "#3b2720", fontFamily: "Georgia, serif", textAlign: "center", padding: 16 }}>
        <div>
          <h1 style={{ fontWeight: 400 }}>Moss &amp; Moon is having a moment ☕</h1>
          <p style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>We&apos;ve been told about it. Please try again in a minute.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 22px", borderRadius: 999, border: "none", background: "#5a3a2c", color: "#fffaf6", fontSize: 16 }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
