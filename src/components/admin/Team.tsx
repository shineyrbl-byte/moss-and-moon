"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";

type Member = { id: number; name: string; username: string; role: "owner" | "barista"; active: number; created_at: string; ordersHandled: number };
const send = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Owner: staff accounts and roles
export default function Team() {
  const { toast } = useStore();
  const [team, setTeam] = useState<Member[]>([]);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "barista" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/staff");
    if (r.ok) setTeam(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/admin/staff", send("POST", form));
    const d = await r.json();
    if (!r.ok) return setError(d.error);
    toast(`${form.name} can log in now ✿`);
    setForm({ name: "", username: "", password: "", role: "barista" });
    load();
  }

  async function update(m: Member, body: Record<string, unknown>, msg: string) {
    const r = await fetch("/api/admin/staff", send("PATCH", { id: m.id, ...body }));
    if (!r.ok) return toast((await r.json()).error);
    toast(msg);
    load();
  }

  return (
    <div className="account-grid" style={{ marginTop: 0 }}>
      <div className="card account-card">
        <h3>Team</h3>
        <p className="small muted">You (the owner) log in with the passcode. Give everyone else their own login, so you can switch it off if they leave.</p>
        {!team.length && <p className="muted small">No staff accounts yet.</p>}
        {team.map((m) => (
          <div key={m.id} className="team-row" style={{ opacity: m.active ? 1 : 0.5 }}>
            <span className="avatar">{m.name[0]?.toUpperCase()}</span>
            <div style={{ flex: 1 }}>
              <strong>{m.name}</strong>
              <small className="muted" style={{ display: "block" }}>@{m.username} · {m.role} · {m.ordersHandled} orders in 30 days{m.active ? "" : " · switched off"}</small>
            </div>
            <select className="input" style={{ width: "auto", padding: "0.3rem 0.6rem" }} value={m.role} onChange={(e) => update(m, { role: e.target.value }, "Role updated")} aria-label={`${m.name}'s role`}>
              <option value="barista">Barista</option><option value="owner">Owner</option>
            </select>
            <button className="chip" onClick={() => {
              const pw = window.prompt?.(`New password for ${m.name} (8+ characters)`);
              if (pw) update(m, { password: pw }, "Password changed");
            }}>Reset password</button>
            <button className="chip" onClick={() => update(m, { active: !m.active }, m.active ? `${m.name} switched off` : `${m.name} is back`)}>{m.active ? "Switch off" : "Switch on"}</button>
          </div>
        ))}
      </div>
      <form className="card account-card" onSubmit={add}>
        <h3>Add someone</h3>
        <label className="field">Name<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">Username<input className="input" required autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="e.g. riya" /></label>
        <label className="field">Password (8+ characters)<input className="input" required type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <label className="field">Role
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="barista">Barista: orders, bookings, tables, stock</option>
            <option value="owner">Owner: everything, including money & menu</option>
          </select>
        </label>
        {error && <p className="error small">{error}</p>}
        <button className="btn btn-pink">Create login</button>
      </form>
    </div>
  );
}
