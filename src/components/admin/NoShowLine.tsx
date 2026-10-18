"use client";
import { useEffect, useState } from "react";
import { DEPOSIT } from "@/lib/cafe";
import { rupees } from "@/lib/pricing";

/** Bookings tab: how many didn't turn up lately */
export default function NoShowLine() {
  const [s, setS] = useState<{ total: number; noShows: number; kept: number } | null>(null);
  useEffect(() => { fetch("/api/admin/no-shows").then((r) => r.json()).then(setS).catch(() => {}); }, []);
  if (!s || !s.total) return null;
  return (
    <p className="small muted" style={{ marginTop: 0 }}>
      Last 30 days: <b>{s.noShows}</b> no-show{s.noShows === 1 ? "" : "s"} out of {s.total} bookings ({Math.round((s.noShows / s.total) * 100)}%){s.kept ? ` · ${rupees(s.kept)} in deposits kept` : ""}. Groups of {DEPOSIT.minGuests}+ pay a deposit.
    </p>
  );
}
