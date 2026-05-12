"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAuthHeaders } from "@/lib/client-auth";
import { responseError, responseMessage, safeJson } from "@/lib/client-safe-json";

type Project = { id: string; name: string; code: string };
type Drawing = { id: string; drawingNo: string; name: string; version: string };
type Material = { id: string; specId: string; name: string; spec: string; material: string; dimensions: string; unit: string };
type RequestRow = { id: string; requestNo: string; project: string; applicant: string; material: string; quantity: string; purpose: string; expected: string; statusText: string };

export function PurchaseRequestsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ projectId: "", drawingId: "", materialKey: "", quantity: 1, expectedArrival: "", purpose: "", remark: "" });

  async function load() {
    const [p, m, r] = await Promise.all([
      fetch("/api/projects", { headers: await getAuthHeaders(), cache: "no-store" }).then((res) => res.json()),
      fetch("/api/materials", { headers: await getAuthHeaders(), cache: "no-store" }).then((res) => res.json()),
      fetch("/api/purchase-requests", { headers: await getAuthHeaders(), cache: "no-store" }).then((res) => res.json())
    ]);
    setProjects(p.projects ?? []);
    setMaterials(m.materials ?? []);
    setRequests(r.requests ?? []);
  }

  async function loadDrawings(projectId: string) {
    setDrawings([]);
    setForm((old) => ({ ...old, projectId, drawingId: "" }));
    if (!projectId) return;
    const payload = await fetch(`/api/project-drawings?projectId=${encodeURIComponent(projectId)}`, { headers: await getAuthHeaders(), cache: "no-store" }).then((res) => res.json());
    setDrawings(payload.drawings ?? []);
  }

  async function submit() {
    const selected = materials.find((item) => `${item.id}|${item.specId}` === form.materialKey);
    if (!form.projectId) return setError("请选择工程项目。");
    if (drawings.length > 0 && !form.drawingId) return setError("该项目已有图号，采购申请必须选择图号。");
    if (!selected) return setError("请选择材料规格。");
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/purchase-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ ...form, materialId: selected.id, specId: selected.specId, unit: selected.unit })
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      setError(responseError(payload, "采购申请提交失败。"));
      setBusy(false);
      return;
    }
    setMessage(responseMessage(payload, "采购申请已提交。"));
    setForm({ projectId: "", drawingId: "", materialKey: "", quantity: 1, expectedArrival: "", purpose: "", remark: "" });
    await load();
    setBusy(false);
  }

  useEffect(() => {
    void load();
    const projectId = new URLSearchParams(window.location.search).get("projectId");
    if (projectId) void loadDrawings(projectId);
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
      <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
        <h2 className="text-lg font-black text-ink">提交采购申请</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <label className="grid gap-2"><span className="form-label">工程项目</span><select className="field" value={form.projectId} onChange={(e) => void loadDrawings(e.target.value)}><option value="">请选择</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="grid gap-2"><span className="form-label">项目图号</span><select className="field" value={form.drawingId} onChange={(e) => setForm({ ...form, drawingId: e.target.value })}><option value="">{drawings.length > 0 ? "选择项目图号（必选）" : "该项目暂无图号"}</option>{drawings.map((d) => <option key={d.id} value={d.id}>{d.drawingNo} / {d.name} / {d.version}</option>)}</select></label>
          <label className="grid gap-2"><span className="form-label">材料规格</span><select className="field" value={form.materialKey} onChange={(e) => setForm({ ...form, materialKey: e.target.value })}><option value="">请选择</option>{materials.map((m) => <option key={`${m.id}|${m.specId}`} value={`${m.id}|${m.specId}`}>{`${m.name} ${m.material} ${m.spec} ${m.dimensions}`}</option>)}</select></label>
          <label className="grid gap-2"><span className="form-label">数量</span><input className="field" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
          <label className="grid gap-2"><span className="form-label">期望到货</span><input className="field" type="date" value={form.expectedArrival} onChange={(e) => setForm({ ...form, expectedArrival: e.target.value })} /></label>
          <label className="grid gap-2"><span className="form-label">用途</span><input className="field" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
          <label className="grid gap-2"><span className="form-label">备注</span><input className="field" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></label>
          <button className="btn-primary" disabled={busy} onClick={() => void submit()}>{busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}提交审批</button>
        </div>
      </section>
      <section className="grid gap-3">
        {message ? <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div> : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
        <div className="grid gap-3 md:hidden">{requests.map((r) => <div key={r.id} className="rounded-lg border border-line bg-white p-4"><div className="font-black">{r.requestNo}</div><div className="mt-1 text-sm">{r.project}</div><div className="mt-1 text-sm text-ink/70">{r.material}</div><div className="mt-2"><StatusBadge status={r.statusText} /></div></div>)}</div>
        <div className="hidden overflow-x-auto rounded-lg border border-line bg-white md:block"><table className="w-full min-w-[860px] text-left"><thead className="bg-field"><tr>{["申请单号","工程","申请人","材料","数量","用途","期望到货","状态"].map((c,index)=><th className="px-4 py-3 text-sm font-black" key={`${c}-${index}`}>{c}</th>)}</tr></thead><tbody className="divide-y divide-line">{requests.map((r)=><tr key={r.id}>{[r.requestNo,r.project,r.applicant,r.material,r.quantity,r.purpose,r.expected].map((v,index)=><td className="px-4 py-3 text-sm text-ink/75" key={`${r.id}-${index}`}>{v}</td>)}<td className="px-4 py-3"><StatusBadge status={r.statusText}/></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
