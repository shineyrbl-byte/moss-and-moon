import type { Metadata } from "next";

export const metadata: Metadata = { title: "Meet the team", description: "The people behind the counter at Moss & Moon, and the drinks they love." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
