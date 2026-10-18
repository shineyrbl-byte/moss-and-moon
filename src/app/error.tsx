"use client";
import Link from "next/link";
import { useEffect } from "react";
import { reportBrowserError } from "@/components/ErrorReporter";

// Shown when a page crashes: a friendly message instead of a blank screen
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportBrowserError(error.message || "Page crashed", `${error.digest ? `digest: ${error.digest}\n` : ""}${error.stack ?? ""}`);
  }, [error]);
  return (
    <div className="page center">
      <p className="eyebrow">oops</p>
      <h1 className="h2">Someone <em>spilled</em> something ☕</h1>
      <p className="lead">This page hit a problem. We&apos;ve been told about it. Try again, or head back to the menu.</p>
      <div className="row" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
        <button className="btn btn-pink" onClick={reset}>Try again</button>
        <Link href="/" className="btn btn-ghost">Back to the café</Link>
      </div>
    </div>
  );
}
