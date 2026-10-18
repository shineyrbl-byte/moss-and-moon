import fs from "node:fs";
import { ownerGate } from "@/lib/auth";
import { backupFile, listBackups, makeBackup, restoreBackup } from "@/lib/backup";

const MAX_UPLOAD = 60 * 1024 * 1024;

function download(name: string, file: string) {
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}

// Owner: list backups, download one (?file=…), or download a fresh one (?fresh=1)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const p = new URL(req.url).searchParams;
  if (p.get("fresh")) {
    const b = makeBackup("manual");
    return download(b.name, b.file);
  }
  const name = p.get("file");
  if (name) {
    const file = backupFile(name);
    return file ? download(name, file) : Response.json({ error: "Backup not found." }, { status: 404 });
  }
  return Response.json({ backups: listBackups() });
}

// Owner: back up right now
export async function POST() {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = makeBackup("manual");
  return Response.json({ ok: true, name: b.name, size: b.size });
}

// Owner: restore from an uploaded backup file (the current data is backed up first)
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const size = Number(req.headers.get("content-length") ?? 0);
  if (size > MAX_UPLOAD) return Response.json({ error: "That file is too big for a backup." }, { status: 413 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_UPLOAD) return Response.json({ error: "Please choose a backup file." }, { status: 400 });
  try {
    const r = restoreBackup(bytes);
    return Response.json({ ok: true, undo: r.undo });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't restore that file." }, { status: 400 });
  }
}
