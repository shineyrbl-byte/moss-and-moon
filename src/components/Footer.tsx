import Link from "next/link";
import { HOURS_LABEL } from "@/lib/cafe";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <p className="logo">Moss <span>&</span> Moon</p>
          <p className="muted small" style={{ maxWidth: "22rem", marginTop: "0.6rem" }}>
            A slow-coffee corner with pink lattes, warm bakes and a sunny window seat. Made with oat milk & love.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><Link href="/#menu">Menu</Link></li>
            <li><Link href="/#events">Events</Link></li>
            <li><Link href="/#reviews">Reviews</Link></li>
            <li><Link href="/loyalty">Stamp card</Link></li>
            <li><Link href="/gift-cards">Gift cards</Link></li>
            <li><Link href="/orders">My orders</Link></li>
          </ul>
        </div>
        <div>
          <h4>Hours</h4>
          <ul>
            {HOURS_LABEL.map((h) => (
              <li key={h.days}>{h.days} · {h.time}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Say hi</h4>
          <ul>
            <li>14 Willow Lane</li>
            <li>hello@mossandmoon.cafe</li>
            <li><Link href="/admin">Staff login</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Moss & Moon</span>
        <span>Photos from Unsplash</span>
      </div>
    </footer>
  );
}
