import type { Metadata } from "next";

export const metadata: Metadata = { title: "A postcard for you", description: "Someone sent you a postcard from Moss & Moon 💌", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
