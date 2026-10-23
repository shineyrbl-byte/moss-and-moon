"use client";
import { useEffect, useState } from "react";
import { moonNow } from "@/lib/moon";
import { fill, type TKey } from "@/lib/i18n";
import { defaultOptions } from "@/lib/pricing";
import { itemName } from "@/lib/menu";
import { useStore } from "./Store";

/** "🌔 Waxing gibbous · full moon in 2 days", or on full-moon nights the special drink */
export default function MoonLine() {
  const { t, lang, menu, add, toast, setDrawerOpen } = useStore();
  const [m, setM] = useState<ReturnType<typeof moonNow> | null>(null);
  useEffect(() => {
    const f = () => setM(moonNow());
    f();
    const id = setInterval(f, 30 * 60_000);
    return () => clearInterval(id);
  }, []);
  if (!m) return null;
  const special = menu.find((x) => x.fullMoon && !x.soldOut);
  const when = m.fullTonight ? t("moon.tonight") : m.daysToFull === 1 ? t("moon.tomorrow") : fill(t("moon.inDays"), { n: m.daysToFull });
  return (
    <p className="moon-line">
      <span aria-hidden>{m.fullTonight ? "🌕" : m.phase.icon}</span>{" "}
      {!m.fullTonight && <>{t(`moon.${m.phase.id}` as TKey)} · </>}{when}
      {special && (
        <>
          {" · "}
          <button className="link-btn" onClick={() => { add(special.id, defaultOptions(special), 1); toast(`${itemName(special, lang)} added ✿`); setDrawerOpen(true); }}>
            {fill(t("moon.special"), { drink: itemName(special, lang) })}
          </button>
        </>
      )}
    </p>
  );
}
