import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pay it forward", description: "Buy a coffee for a stranger. It waits at Moss & Moon for anyone who needs one." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
