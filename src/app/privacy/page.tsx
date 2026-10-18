import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", description: "How Moss & Moon uses your information." };

export default function Privacy() {
  return (
    <div className="page narrow legal">
      <p className="eyebrow">privacy</p>
      <h1 className="h2">Your information, <em>kept small</em></h1>
      <p className="lead">We only keep what we need to make your coffee and keep in touch, and we never sell it.</p>
      <h2 className="h3">What we keep</h2>
      <ul>
        <li><b>Orders and bookings:</b> your name, phone number, and email if you give one, plus what you ordered.</li>
        <li><b>Accounts:</b> your email, and optionally your name, phone and birthday month and day.</li>
        <li><b>Reviews and noticeboard notes:</b> what you write and the name you give.</li>
        <li><b>Visits:</b> page views counted with a code that changes every day. No cookies or trackers, and Do Not Track is respected.</li>
      </ul>
      <h2 className="h3">How we use it</h2>
      <ul>
        <li>To make and track your order, hold your table, and send the emails you&apos;d expect: confirmations, “it&apos;s ready”, receipts, reminders and a one-off review request.</li>
        <li>Payments are handled by Razorpay; we never see or store your card details.</li>
        <li>Emails are sent from our café Gmail account. We only use Google&apos;s permission to <i>send</i> email, never to read anyone&apos;s inbox.</li>
        <li>If you sign up for the Pink Post, a monthly newsletter. You can unsubscribe any time.</li>
      </ul>
      <h2 className="h3">Who sees it</h2>
      <p>Only the café team. We share data only with the services that run the site: Railway (hosting), Razorpay (payments) and Google (email), and, if you use the AI barista or voice ordering, the AI provider that reads your message.</p>
      <h2 className="h3">Your choices</h2>
      <p>Ask us at the counter or by email and we&apos;ll show you, correct or delete what we hold about you.</p>
      <p className="small muted">Moss &amp; Moon · 14 Willow Lane · Updated October 2026</p>
    </div>
  );
}
