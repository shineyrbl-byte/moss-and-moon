"use client";
import { useEffect, useRef, useState } from "react";

// Fades its children in when they scroll into view.
export default function Reveal({ children, id, className = "" }: { children: React.ReactNode; id?: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Any part of it on screen counts (a share of a very tall section, like the menu, may never fit on a phone)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setShown(true), io.disconnect()), { threshold: 0, rootMargin: "0px 0px -60px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={ref} id={id} className={`reveal ${shown ? "visible" : ""} ${className}`}>
      {children}
    </section>
  );
}
