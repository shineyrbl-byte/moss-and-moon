"use client";
export default function PrintButton() {
  return <button className="btn btn-pink btn-sm" onClick={() => window.print()}>🖨 Print</button>;
}
