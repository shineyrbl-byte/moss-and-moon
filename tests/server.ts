// Starts the built site on a spare port with a brand-new, empty database,
// so tests never touch real data. Needs `npm run build` first.
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PASSCODE = "test-passcode";

export type TestServer = {
  url: string;
  dataDir: string;
  stop: () => Promise<void>;
  /** fetch JSON from the test server; keeps the staff cookie if logged in */
  api: (p: string, init?: RequestInit & { json?: unknown }) => Promise<{ status: number; body: any }>;
  login: () => Promise<void>;
};

export async function startServer(port = 3900 + Math.floor(Math.random() * 90)): Promise<TestServer> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-test-"));
  const child: ChildProcess = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port)], {
    env: { ...process.env, DATA_DIR: dataDir, ADMIN_PASSCODE: PASSCODE, SITE_URL: `http://localhost:${port}`, ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "", RESEND_API_KEY: "", RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout?.on("data", (d) => (log += d));
  child.stderr?.on("data", (d) => (log += d));

  const url = `http://localhost:${port}`;
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${url}/api/queue`);
      if (r.ok) break;
    } catch {}
    if (i > 120) throw new Error(`Test server didn't start:\n${log}`);
    await new Promise((r) => setTimeout(r, 250));
  }

  let cookie = "";
  const api: TestServer["api"] = async (p, init = {}) => {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (cookie) headers.cookie = cookie;
    let body = init.body;
    if (init.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    }
    const r = await fetch(url + p, { ...init, headers, body, redirect: "manual" });
    const set = r.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const pair = c.split(";")[0];
      const name = pair.split("=")[0];
      cookie = [...cookie.split("; ").filter((x) => x && !x.startsWith(name + "=")), pair].join("; ");
    }
    const text = await r.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch {}
    return { status: r.status, body: parsed };
  };

  return {
    url,
    dataDir,
    api,
    login: async () => {
      const r = await api("/api/admin/login", { method: "POST", json: { passcode: PASSCODE } });
      if (r.status !== 200) throw new Error("Staff login failed in tests: " + JSON.stringify(r.body));
    },
    stop: async () => {
      child.kill();
      await new Promise((r) => setTimeout(r, 200));
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
