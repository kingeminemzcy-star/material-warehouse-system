"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAuthHeaders } from "@/lib/client-auth";

type Project = {
  id: string;
  code: string;
  name: string;
  customer: string;
  address: string;
  remark: string;
  managerId: string | null;
  manager: string;
  statusText: string;
  voided?: boolean;
};

type Manager = {
  id: string;
  name: string;
};

export function ProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    customer: "",
    address: "",
    managerId: "",
    remark: "",
    status: "进行中"
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadProjects() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/projects", { headers: await getAuthHeaders(), cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "项目列表加载失败。");
      setLoading(false);
      return;
    }
    setProjects(payload.projects);
    setManagers(payload.managers ?? []);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ code: "", name: "", customer: "", address: "", managerId: "", remark: "", status: "进行中" });
  }

  async function saveProject() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const reason = editingId ? window.prompt("请输入修改原因", "录入信息更正") : null;
    if (editingId && !reason?.trim()) {
      setError("修改项目必须填写原因。");
      setBusy(false);
      return;
    }

    const response = await fetch(editingId ? "/api/projects" : "/api/projects", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(editingId ? { id: editingId, ...form, reason } : form)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "工程项目保存失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "工程项目已保存。");
    resetForm();
    await loadProjects();
    setBusy(false);
  }

  async function removeProject(project: Project) {
    const reason = window.prompt(project.voided ? "项目已作废，仍要继续操作请填写原因" : "请输入删除/作废原因", "项目录入错误或取消");
    if (!reason?.trim()) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/projects?id=${encodeURIComponent(project.id)}&reason=${encodeURIComponent(reason)}`, {
      method: "DELETE",
      headers: await getAuthHeaders()
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "项目删除/作废失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "项目已处理。");
    await loadProjects();
    setBusy(false);
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setForm({
      code: project.code,
      name: project.name,
      customer: project.customer,
      address: project.address,
      managerId: project.managerId ?? "",
      remark: project.remark,
      status: project.statusText === "已作废" ? "暂停" : project.statusText
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-ink">{editingId ? "修改工程" : "新建工程"}</h2>
          {editingId ? (
            <button className="btn-secondary min-h-10 px-3" onClick={resetForm}>
              <X size={16} />
              取消
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <label className="grid gap-2">
            <span className="form-label">项目编号</span>
            <input className="field" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="P-2026-030" />
          </label>
          <label className="grid gap-2">
            <span className="form-label">项目名称</span>
            <input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="客户 + 产线名称" />
          </label>
          <label className="grid gap-2">
            <span className="form-label">客户名称</span>
            <input className="field" value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="form-label">项目地址</span>
            <input className="field" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </label>
          <label className="grid gap-2">
            <span className="form-label">负责人</span>
            <select className="field" value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
              <option value="">未指定</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>{manager.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="form-label">状态</span>
            <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option>待开工</option>
              <option>进行中</option>
              <option>暂停</option>
              <option>已完成</option>
            </select>
          </label>
          <label className="grid gap-2 md:col-span-2 xl:col-span-1">
            <span className="form-label">备注</span>
            <textarea className="field min-h-24" value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} />
          </label>
          <button className="btn-primary" disabled={busy} onClick={() => void saveProject()}>
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            {editingId ? "保存修改" : "保存工程"}
          </button>
        </div>
      </section>
      <section className="grid gap-4">
        {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-field">
              <tr>
                {["项目编号", "项目名称", "客户", "地址", "负责人", "状态", "备注", "操作"].map((column) => (
                  <th key={column} className="px-4 py-3 text-sm font-black text-ink">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-ink/60">正在加载项目...</td></tr> : null}
              {!loading && projects.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-ink/60">暂无项目。</td></tr> : null}
              {projects.map((project) => (
                <tr key={project.id} className={project.voided ? "bg-slate-50 text-ink/55" : ""}>
                  <td className="px-4 py-3 text-sm font-semibold text-ink">{project.code}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{project.name}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{project.customer}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{project.address}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{project.manager}</td>
                  <td className="px-4 py-3 text-sm text-ink/78"><StatusBadge status={project.statusText} /></td>
                  <td className="px-4 py-3 text-sm text-ink/78">{project.remark}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="btn-secondary min-h-10 px-3" disabled={busy} onClick={() => startEdit(project)}>
                        <Pencil size={16} />
                        修改
                      </button>
                      <button className="btn-secondary min-h-10 px-3" disabled={busy} onClick={() => void removeProject(project)}>
                        <Trash2 size={16} />
                        删除/作废
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
