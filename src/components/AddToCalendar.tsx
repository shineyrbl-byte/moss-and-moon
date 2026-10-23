"use client";
import { googleCalUrl, icsText, type CalEvent } from "@/lib/ics";
import { useStore } from "./Store";

/** "📅 Add to calendar" (an .ics file for Apple, Outlook and phones) and a Google Calendar link */
export default function AddToCalendar({ event, small = true }: { event: CalEvent; small?: boolean }) {
  const { t } = useStore();
  function download() {
    const url = URL.createObjectURL(new Blob([icsText(event)], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `moss-and-moon-${event.uid}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return (
    <span className="add-cal">
      <button type="button" className={`btn btn-ghost ${small ? "btn-sm" : ""}`} onClick={download}>📅 {t("cal.add")}</button>
      <a className={`btn btn-ghost ${small ? "btn-sm" : ""}`} href={googleCalUrl(event)} target="_blank" rel="noreferrer">{t("cal.google")}</a>
    </span>
  );
}
