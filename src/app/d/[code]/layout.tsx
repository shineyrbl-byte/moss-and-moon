import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "A coffee for you",
  description: "Someone bought you a drink at Moss & Moon ☕",
  openGraph: { title: "Someone bought you a coffee ☕", description: "Open it to see who, and claim your drink at Moss & Moon." },
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
