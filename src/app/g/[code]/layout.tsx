import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Group order",
  description: "Add your drinks to our Moss & Moon group order ✿",
  openGraph: { title: "Join our group order at Moss & Moon 👯", description: "Pick your drink, we'll order together." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
