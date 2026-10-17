import Link from "next/link";


// Shown by the app when there's no internet and the page wasn't saved yet
export default function Offline() {
  return (
    <div className="page center">
      <p style={{ fontSize: "3rem" }}>☁︎</p>
      <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 3.6rem)" }}>You&apos;re <em>offline</em></h1>
      <p className="lead">No internet right now. Pages you&apos;ve opened before still work, so try the menu or your orders.</p>
      <div className="row" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
        <Link href="/" className="btn">Home</Link>
        <Link href="/orders" className="btn btn-ghost">My orders</Link>
      </div>
    </div>
  );
}
