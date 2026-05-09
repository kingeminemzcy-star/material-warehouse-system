"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "@/lib/client-auth";

type Log = { id:string; actor:string; action:string; material:string; project:string; remark:string; createdAt:string };

export function LogsClient() {
  const [logs,setLogs]=useState<Log[]>([]); const [keyword,setKeyword]=useState(""); const [action,setAction]=useState("全部操作");
  async function load(){const p=await fetch("/api/logs",{headers:await getAuthHeaders(),cache:"no-store"}).then(r=>r.json()); setLogs(p.logs??[]);}
  useEffect(()=>{void load();},[]);
  const filtered=useMemo(()=>logs.filter(l=>(action==="全部操作"||l.action===action)&&(!keyword.trim()||[l.actor,l.material,l.project,l.remark,l.action].join(" ").toLowerCase().includes(keyword.toLowerCase()))),[action,keyword,logs]);
  return <div className="grid gap-4"><section className="rounded-lg border border-line bg-white p-4"><div className="grid gap-3 md:grid-cols-4"><input className="field md:col-span-2" placeholder="人员、材料、项目、备注" value={keyword} onChange={e=>setKeyword(e.target.value)}/><select className="field" value={action} onChange={e=>setAction(e.target.value)}>{["全部操作","PURCHASE_REQUEST","APPROVAL","PURCHASE_ORDER","INBOUND","OUTBOUND","UPDATE","DELETE","STOCK_ADJUSTMENT","LOGIN"].map(a=><option key={a}>{a}</option>)}</select><button className="btn-primary" onClick={()=>void load()}>刷新</button></div></section><div className="grid gap-3 md:hidden">{filtered.map(l=><div key={l.id} className="rounded-lg border border-line bg-white p-4"><div className="font-black">{l.action}</div><div className="mt-1 text-sm">{l.actor} / {l.project}</div><div className="mt-1 text-sm text-ink/70">{l.remark}</div><div className="mt-2 text-xs text-ink/50">{l.createdAt?.slice(0,16)}</div></div>)}</div><div className="hidden overflow-x-auto rounded-lg border border-line bg-white md:block"><table className="w-full min-w-[900px] text-left"><thead className="bg-field"><tr>{["人员","操作类型","材料","工程","备注","时间"].map(c=><th key={c} className="px-4 py-3 text-sm font-black">{c}</th>)}</tr></thead><tbody className="divide-y divide-line">{filtered.map(l=><tr key={l.id}><td className="px-4 py-3 text-sm">{l.actor}</td><td className="px-4 py-3 text-sm">{l.action}</td><td className="px-4 py-3 text-sm">{l.material}</td><td className="px-4 py-3 text-sm">{l.project}</td><td className="px-4 py-3 text-sm">{l.remark}</td><td className="px-4 py-3 text-sm">{l.createdAt?.slice(0,16)}</td></tr>)}</tbody></table></div></div>;
}
