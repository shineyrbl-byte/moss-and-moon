import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms", description: "The small print for ordering at Moss & Moon." };

export default function Terms() {
  return (
    <div className="page narrow legal">
      <p className="eyebrow">terms</p>
      <h1 className="h2">The <em>small print</em></h1>
      <ul>
        <li><b>Orders:</b> prices are shown in rupees and include taxes. Times are estimates; we do our best.</li>
        <li><b>Payments:</b> online payments go through Razorpay. Refunds go back to the original payment method, usually in 5–7 working days.</li>
        <li><b>Allergies:</b> allergen and calorie information is approximate. Our kitchen handles nuts, gluten, milk, egg, soy and sesame, so please tell us about severe allergies.</li>
        <li><b>Bookings:</b> we hold tables for 15 minutes. Please call if plans change so someone on the waitlist can come.</li>
        <li><b>Gift cards and gifted drinks:</b> gift cards don&apos;t expire; gifted drinks can be claimed within 90 days. Neither can be swapped for cash.</li>
        <li><b>Event tickets:</b> refundable up to 24 hours before the event.</li>
        <li><b>Reviews and notes:</b> please be kind. We may remove anything unkind, untrue or unrelated.</li>
      </ul>
      <p className="small muted">Moss &amp; Moon · 14 Willow Lane · Updated October 2026</p>
    </div>
  );
}
