"use client";
export default function PrintButton() {
  return (
    <div className="mc-actions">
      <button className="btn btn-pink btn-sm" onClick={() => window.print()}>🖨 Print or save as PDF</button>
      <a className="btn btn-ghost btn-sm" href="?">A4 menu</a>
      <a className="btn btn-ghost btn-sm" href="?poster=1">Counter poster</a>
    </div>
  );
}
