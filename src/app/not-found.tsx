import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page center">
      <p className="eyebrow">404</p>
      <h1 className="h2">This page <em>wandered off</em></h1>
      <p className="lead">Maybe it went for a coffee. Let&apos;s get you back.</p>
      <Link href="/" className="btn" style={{ marginTop: "1.5rem" }}>Back to the café</Link>
    </div>
  );
}
