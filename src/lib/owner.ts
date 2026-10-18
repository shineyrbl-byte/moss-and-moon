// Where owner-only emails go (nightly summary, error alerts, backups)
import "server-only";
import { cleanEmail, getSetting, setSetting } from "./db";

export const ownerEmail = () => cleanEmail(getSetting("owner_email") || process.env.OWNER_EMAIL || "");
export const setOwnerEmail = (email: string) => setSetting("owner_email", email);

/** On/off switches for owner emails. Default: on (they only send once an owner email is set). */
export const ownerPref = (key: "daily_summary" | "error_alerts" | "backup_email") => getSetting(key) !== "off";
export const setOwnerPref = (key: "daily_summary" | "error_alerts" | "backup_email", on: boolean) => setSetting(key, on ? "on" : "off");
