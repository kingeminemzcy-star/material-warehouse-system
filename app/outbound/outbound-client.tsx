"use client";

import { useEffect, useState } from "react";
import { Loader2, PackageMinus } from "lucide-react";
import { PhotoUploader } from "@/components/photo-uploader";
import { getAuthHeaders } from "@/lib/client-auth";

type Lot = { id:string; materialId:string; specId:string; name:string; spec:string; material:string; dimensions:string; quantity:number; unit:string; zoneText:string; locationCode:string };
type Project = { id:string; name:string };
type Drawing = { id:string; drawingNo:string; name:string; version:string };

export function OutboundClient() {
  const [lots,setLots]=useState<Lot[]>([]); const [projects,setProjects]=useState<Project[]>([]);
  const [drawings,setDrawings]=useState<Drawing[]>([]);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null); const [error,setError]=useState<string|null>(null);
  const [form,setForm]=useState({projectId:"",drawingId:"",lotId:"",quantity:1,purpose:"",remark:""});
  async function load(){const [i,p]=await Promise.all([fetch("/api/inventory",{headers:await getAuthHeaders(),cache:"no-store"}).then(r=>r.json()),fetch("/api/projects",{headers:await getAuthHeaders(),cache:"no-store"}).then(r=>r.json())]); setLots(i.inventory??[]); setProjects(p.projects??[]);}
  async function loadDrawings(projectId:string){setDrawings([]); setForm((old)=>({...old,projectId,drawingId:""})); if(!projectId)return; const p=await fetch(`/api/project-drawings?projectId=${encodeURIComponent(projectId)}`,{headers:await getAuthHeaders(),cache:"no-store"}).then(r=>r.json()); setDrawings(p.drawings??[]);}
  async function submit(){const lot=lots.find(l=>l.id===form.lotId); if(!form.projectId)return setError("请选择工程项目。"); if(!form.drawingId)return setError("出库必须选择项目图号。"); if(!lot)return setError("请选择库存批次。"); setBusy(true); setError(null); setMessage(null); const res=await fetch("/api/outbound",{method:"POST",headers:{"Content-Type":"application/json",...(await getAuthHeaders())},body:JSON.stringify({projectId:form.projectId,drawingId:form.drawingId,materialId:lot.materialId,specId:lot.specId,zone:lot.zoneText,locationCode:lot.locationCode,quantity:form.quantity,unit:lot.unit,purpose:form.purpose,remark:form.remark})}); const payload=await res.json(); if(!res.ok){setError(payload.error||"出库失败。"); setBusy(false); return;} setMessage(payload.message); await load(); setBusy(false);}
  useEffect(()=>{void load(); const projectId=new URLSearchParams(window.location.search).get("projectId"); if(projectId) void loadDrawings(projectId);},[]);
  return <div className="grid gap-6 xl:grid-cols-[430px_1fr]"><section className="rounded-lg border border-line bg-white p-4 shadow-soft"><h2 className="text-lg font-black">办理出库</h2><div className="mt-4 grid gap-4">
    <select className="field" value={form.projectId} onChange={e=>void loadDrawings(e.target.value)}><option value="">选择工程项目</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <select className="field" value={form.drawingId} onChange={e=>setForm({...form,drawingId:e.target.value})}><option value="">选择项目图号（必选）</option>{drawings.map(d=><option key={d.id} value={d.id}>{d.drawingNo} / {d.name}</option>)}</select>
    <select className="field" value={form.lotId} onChange={e=>setForm({...form,lotId:e.target.value})}><option value="">选择库存材料</option>{lots.map(l=><option key={l.id} value={l.id}>{`${l.name} ${l.material} ${l.spec} ${l.dimensions} / ${l.zoneText}-${l.locationCode} / 库存 ${l.quantity}${l.unit}`}</option>)}</select>
    <input className="field" type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})}/>
    <input className="field" placeholder="用途" value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})}/>
    <input className="field" placeholder="备注" value={form.remark} onChange={e=>setForm({...form,remark:e.target.value})}/>
    <PhotoUploader label="出库照片" />
    <button className="btn-primary min-h-14 text-lg" disabled={busy} onClick={()=>void submit()}>{busy?<Loader2 className="animate-spin" size={22}/>:<PackageMinus size={22}/>}确认出库并扣减库存</button>
  </div></section><section>{message?<div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div>:null}{error?<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>:null}<div className="mt-3 rounded-lg border border-line bg-white p-5 text-sm text-ink/65">出库会校验库存，库存不足时禁止提交。</div></section></div>;
}
