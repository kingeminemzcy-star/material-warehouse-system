"use client";

import { useEffect, useState } from "react";
import { Loader2, PackagePlus } from "lucide-react";
import { PhotoUploader } from "@/components/photo-uploader";
import { getAuthHeaders } from "@/lib/client-auth";
import { inboundSourceLabels, zoneOptions } from "@/lib/warehouse-maps";

type Material = { id: string; specId: string; name: string; spec: string; material: string; dimensions: string; unit: string };
type Project = { id: string; name: string };
type Order = { id: string; orderNo: string; supplier: string; statusText: string };
type Drawing = { id: string; drawingNo: string; name: string; version: string };

export function InboundClient() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ source: "采购到货", purchaseOrderId: "", materialKey: "", quantity: 1, zone: "备件区", locationCode: "A-01", projectId: "", drawingId: "", remark: "" });
  async function load() {
    const [m, p, o] = await Promise.all([
      fetch("/api/materials", { headers: await getAuthHeaders(), cache: "no-store" }).then((r) => r.json()),
      fetch("/api/projects", { headers: await getAuthHeaders(), cache: "no-store" }).then((r) => r.json()),
      fetch("/api/purchase-orders", { headers: await getAuthHeaders(), cache: "no-store" }).then((r) => r.json())
    ]);
    setMaterials(m.materials ?? []); setProjects(p.projects ?? []); setOrders(o.orders ?? []);
  }
  async function submit() {
    const selected = materials.find((m) => `${m.id}|${m.specId}` === form.materialKey);
    if (!selected) return setError("请选择材料规格。");
    setBusy(true); setError(null); setMessage(null);
    const res = await fetch("/api/inbound", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) }, body: JSON.stringify({ ...form, materialId: selected.id, specId: selected.specId, unit: selected.unit }) });
    const payload = await res.json();
    if (!res.ok) { setError(payload.error || "入库失败。"); setBusy(false); return; }
    setMessage(payload.message); await load(); setBusy(false);
  }
  async function loadDrawings(projectId: string) {
    setDrawings([]);
    setForm({ ...form, projectId, drawingId: "" });
    if (!projectId) return;
    const payload = await fetch(`/api/project-drawings?projectId=${encodeURIComponent(projectId)}`, { headers: await getAuthHeaders(), cache: "no-store" }).then((r) => r.json());
    setDrawings(payload.drawings ?? []);
  }
  useEffect(() => { void load(); }, []);
  return <div className="grid gap-6 xl:grid-cols-[430px_1fr]"><section className="rounded-lg border border-line bg-white p-4 shadow-soft"><h2 className="text-lg font-black">办理入库</h2><div className="mt-4 grid gap-4">
    <select className="field" value={form.source} onChange={(e)=>setForm({...form,source:e.target.value})}>{Object.values(inboundSourceLabels).map(v=><option key={v}>{v}</option>)}</select>
    <select className="field" value={form.purchaseOrderId} onChange={(e)=>setForm({...form,purchaseOrderId:e.target.value})}><option value="">手动入库/无采购单</option>{orders.map(o=><option key={o.id} value={o.id}>{`${o.orderNo} / ${o.supplier} / ${o.statusText}`}</option>)}</select>
    <select className="field" value={form.materialKey} onChange={(e)=>setForm({...form,materialKey:e.target.value})}><option value="">选择材料规格</option>{materials.map(m=><option key={`${m.id}|${m.specId}`} value={`${m.id}|${m.specId}`}>{`${m.name} ${m.material} ${m.spec} ${m.dimensions}`}</option>)}</select>
    <input className="field" type="number" value={form.quantity} onChange={(e)=>setForm({...form,quantity:Number(e.target.value)})} />
    <select className="field" value={form.zone} onChange={(e)=>setForm({...form,zone:e.target.value})}>{zoneOptions.map(z=><option key={z.value}>{z.label}</option>)}</select>
    <input className="field" placeholder="库位" value={form.locationCode} onChange={(e)=>setForm({...form,locationCode:e.target.value})}/>
    <select className="field" value={form.projectId} onChange={(e)=>void loadDrawings(e.target.value)}><option value="">无关联工程</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <select className="field" value={form.drawingId} onChange={(e)=>setForm({...form,drawingId:e.target.value})}><option value="">不关联图号</option>{drawings.map(d=><option key={d.id} value={d.id}>{d.drawingNo} / {d.name}</option>)}</select>
    <input className="field" placeholder="备注" value={form.remark} onChange={(e)=>setForm({...form,remark:e.target.value})}/>
    <PhotoUploader label="入库照片" />
    <button className="btn-primary min-h-14 text-lg" disabled={busy} onClick={()=>void submit()}>{busy?<Loader2 className="animate-spin" size={22}/>:<PackagePlus size={22}/>}确认入库并增加库存</button>
  </div></section><section className="grid gap-3">{message?<div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div>:null}{error?<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>:null}<div className="rounded-lg border border-line bg-white p-5 text-sm text-ink/65">入库成功后会自动增加库存，并写入操作日志。</div></section></div>;
}
