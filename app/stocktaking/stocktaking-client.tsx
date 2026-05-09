"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { getAuthHeaders } from "@/lib/client-auth";

type Lot = { id:string; name:string; spec:string; material:string; dimensions:string; quantity:number; unit:string; zoneText:string; locationCode:string; low:boolean };

export function StocktakingClient() {
  const [lots,setLots]=useState<Lot[]>([]);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [draft,setDraft]=useState<Record<string,{actualQty:string;reason:string}>>({});
  async function load(){const p=await fetch("/api/inventory",{headers:await getAuthHeaders(),cache:"no-store"}).then(r=>r.json()); setLots(p.inventory??[]);}
  async function save(lot:Lot){const row=draft[lot.id]; if(!row?.actualQty||!row.reason.trim()){setError("请填写实际数量和盘盈/盘亏原因。"); return;} setBusyId(lot.id); setError(null); setMessage(null); const res=await fetch("/api/inventory",{method:"PATCH",headers:{"Content-Type":"application/json",...(await getAuthHeaders())},body:JSON.stringify({id:lot.id,actualQty:Number(row.actualQty),reason:row.reason})}); const payload=await res.json(); if(!res.ok){setError(payload.error||"盘点调整失败。"); setBusyId(null); return;} setMessage(payload.message); await load(); setBusyId(null);}
  useEffect(()=>{void load();},[]);
  return <div className="grid gap-4">{message?<div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div>:null}{error?<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>:null}
    <div className="grid gap-3 md:hidden">{lots.map(l=><div key={l.id} className="rounded-lg border border-line bg-white p-4"><div className="font-black">{l.name}</div><div className="mt-1 text-sm text-ink/70">{l.material} {l.spec} {l.dimensions}</div><div className="mt-2 text-sm">系统库存：{l.quantity}{l.unit}</div><input className="field mt-3" placeholder="实际数量" value={draft[l.id]?.actualQty??""} onChange={e=>setDraft({...draft,[l.id]:{actualQty:e.target.value,reason:draft[l.id]?.reason??""}})}/><input className="field mt-3" placeholder="盘盈/盘亏原因" value={draft[l.id]?.reason??""} onChange={e=>setDraft({...draft,[l.id]:{actualQty:draft[l.id]?.actualQty??"",reason:e.target.value}})}/><button className="btn-primary mt-3 w-full" onClick={()=>void save(l)}>{busyId===l.id?<Loader2 className="animate-spin" size={18}/>:<Save size={18}/>}保存盘点</button></div>)}</div>
    <div className="hidden overflow-x-auto rounded-lg border border-line bg-white md:block"><table className="w-full min-w-[900px] text-left"><thead className="bg-field"><tr>{["材料","库位","系统库存","实际数量","原因","操作"].map(c=><th key={c} className="px-4 py-3 text-sm font-black">{c}</th>)}</tr></thead><tbody className="divide-y divide-line">{lots.map(l=><tr key={l.id}><td className="px-4 py-3 text-sm">{l.name} {l.material} {l.spec}</td><td className="px-4 py-3 text-sm">{l.zoneText}-{l.locationCode}</td><td className="px-4 py-3 text-sm">{l.quantity}{l.unit}</td><td className="px-4 py-3"><input className="field min-h-10" value={draft[l.id]?.actualQty??""} onChange={e=>setDraft({...draft,[l.id]:{actualQty:e.target.value,reason:draft[l.id]?.reason??""}})}/></td><td className="px-4 py-3"><input className="field min-h-10" value={draft[l.id]?.reason??""} onChange={e=>setDraft({...draft,[l.id]:{actualQty:draft[l.id]?.actualQty??"",reason:e.target.value}})}/></td><td className="px-4 py-3"><button className="btn-primary min-h-10 px-3" onClick={()=>void save(l)}>{busyId===l.id?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>}保存</button></td></tr>)}</tbody></table></div>
  </div>;
}
