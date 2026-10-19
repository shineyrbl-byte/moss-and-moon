import type { Metadata } from "next";

export const metadata: Metadata = { title: "Brew timer", description: "Step-by-step timer for pour-over, AeroPress, French press and moka pot." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
