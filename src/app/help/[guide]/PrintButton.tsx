"use client";
export default function PrintButton() {
  return <button className="btn btn-ghost btn-sm guide-print" onClick={() => window.print()}>🖨 Print this guide</button>;
}
