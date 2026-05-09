"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save, UserPlus } from "lucide-react";
import { getAuthHeaders } from "@/lib/client-auth";

type Account = {
  id: string;
  supabaseUserId: string;
  name: string;
  phone: string | null;
  email: string;
  role: string;
  roleLabel: string;
  isActive: boolean;
};

const roles = ["老板/管理员", "仓库员", "采购员", "项目经理"];

export function AccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "仓库员",
    isActive: true
  });

  async function loadAccounts() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/accounts", { headers: await getAuthHeaders(), cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "账号列表加载失败。");
      setLoading(false);
      return;
    }
    setAccounts(payload.users);
    setLoading(false);
  }

  async function createAccount() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "账号创建失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "账号已创建。");
    setForm({ name: "", email: "", phone: "", password: "", role: "仓库员", isActive: true });
    await loadAccounts();
    setBusy(false);
  }

  async function updateAccount(account: Account, patch: Partial<Account> & { password?: string }) {
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ supabaseUserId: account.supabaseUserId, ...patch })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "账号更新失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "账号已更新。");
    await loadAccounts();
    setBusy(false);
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <h2 className="text-lg font-black text-ink">创建账号</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <label className="grid gap-2">
            <span className="form-label">姓名</span>
            <input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="form-label">邮箱</span>
            <input className="field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="form-label">手机号</span>
            <input className="field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="form-label">初始密码</span>
            <input className="field" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="form-label">角色</span>
            <select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" className="h-5 w-5" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
            启用账号
          </label>
          <button className="btn-primary" disabled={busy} onClick={() => void createAccount()}>
            {busy ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
            创建账号
          </button>
        </div>
      </section>

      <section className="grid gap-4">
        {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-field">
              <tr>
                {["姓名", "邮箱", "手机号", "角色", "状态", "操作"].map((column) => (
                  <th key={column} className="px-4 py-3 text-sm font-black text-ink">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink/60">正在加载账号...</td></tr>
              ) : null}
              {accounts.map((account) => (
                <tr key={account.supabaseUserId}>
                  <td className="px-4 py-3"><input className="field min-h-10" defaultValue={account.name} onBlur={(event) => event.target.value !== account.name && void updateAccount(account, { name: event.target.value })} /></td>
                  <td className="px-4 py-3 text-sm text-ink/70">{account.email}</td>
                  <td className="px-4 py-3"><input className="field min-h-10" defaultValue={account.phone ?? ""} onBlur={(event) => event.target.value !== (account.phone ?? "") && void updateAccount(account, { phone: event.target.value })} /></td>
                  <td className="px-4 py-3">
                    <select className="field min-h-10" defaultValue={account.roleLabel} onChange={(event) => void updateAccount(account, { role: event.target.value })}>
                      {roles.map((role) => <option key={role}>{role}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">{account.isActive ? "启用" : "禁用"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="btn-secondary min-h-10 px-3" disabled={busy} onClick={() => void updateAccount(account, { isActive: !account.isActive })}>
                        <Save size={16} />
                        {account.isActive ? "禁用" : "启用"}
                      </button>
                      <button className="btn-secondary min-h-10 px-3" disabled={busy} onClick={() => {
                        const password = window.prompt("输入新密码", "Reset@2026");
                        if (password) void updateAccount(account, { password });
                      }}>
                        <RotateCcw size={16} />
                        重置密码
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
