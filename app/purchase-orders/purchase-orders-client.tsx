"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, ClipboardCheck, Loader2, ShoppingCart, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAuthHeaders } from "@/lib/client-auth";
import { responseError, responseMessage, safeJson } from "@/lib/client-safe-json";

type ApprovedRequest = { id: string; requestNo: string };
type Order = { id: string; orderNo: string; requestNo: string; supplier: string; purchaser: string; amount: number; expectedArrival: string; statusText: string; receivedQty: number; orderedQty: number };

export function PurchaseOrdersClient() {
  const [approvedRequests, setApprovedRequests] = useState<ApprovedRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ purchaseRequestId: "", supplier: "", totalAmount: 0, expectedArrival: "", remark: "" });

  async function load() {
    const payload = await fetch("/api/purchase-orders", { headers: await getAuthHeaders(), cache: "no-store" }).then((r) => r.json());
    setApprovedRequests(payload.approvedRequests ?? []);
    setOrders(payload.orders ?? []);
  }
  async function submit() {
    setBusy(true); setError(null); setMessage(null);
    const res = await fetch("/api/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) }, body: JSON.stringify(form) });
    const payload = await safeJson(res);
    if (!res.ok) { setError(responseError(payload, "采购单创建失败。")); setBusy(false); return; }
    setMessage(responseMessage(payload, "采购单已创建。")); setForm({ purchaseRequestId: "", supplier: "", totalAmount: 0, expectedArrival: "", remark: "" }); await load(); setBusy(false);
  }
  async function flowAction(order: Order, action: "completePurchase" | "acceptArrival" | "rejectArrival" | "remind") {
    const label = action === "completePurchase" ? "采购完成确认备注" : action === "acceptArrival" ? "验收通过备注" : action === "rejectArrival" ? "验收拒绝原因" : "催货提醒备注";
    const remark = window.prompt(label, action === "remind" ? "请供应商确认预计到货时间" : "");
    if (remark === null) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/purchase-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ id: order.id, action, remark })
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      setError(responseError(payload, "采购流程操作失败。"));
      setBusy(false);
      return;
    }
    setMessage(responseMessage(payload, "采购流程操作已完成。"));
    await load();
    setBusy(false);
  }
  useEffect(() => { void load(); }, []);
  return <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft"><h2 className="text-lg font-black">创建采购单</h2><div className="mt-4 grid gap-4">
      <label className="grid gap-2"><span className="form-label">已审批申请</span><select className="field" value={form.purchaseRequestId} onChange={(e)=>setForm({...form,purchaseRequestId:e.target.value})}><option value="">请选择</option>{approvedRequests.map((r)=><option key={r.id} value={r.id}>{r.requestNo}</option>)}</select></label>
      <label className="grid gap-2"><span className="form-label">供应商</span><input className="field" value={form.supplier} onChange={(e)=>setForm({...form,supplier:e.target.value})}/></label>
      <label className="grid gap-2"><span className="form-label">金额</span><input className="field" type="number" value={form.totalAmount} onChange={(e)=>setForm({...form,totalAmount:Number(e.target.value)})}/></label>
      <label className="grid gap-2"><span className="form-label">预计到货</span><input className="field" type="date" value={form.expectedArrival} onChange={(e)=>setForm({...form,expectedArrival:e.target.value})}/></label>
      <label className="grid gap-2"><span className="form-label">备注</span><input className="field" value={form.remark} onChange={(e)=>setForm({...form,remark:e.target.value})}/></label>
      <button className="btn-primary" disabled={busy} onClick={()=>void submit()}>{busy?<Loader2 className="animate-spin" size={18}/>:<ShoppingCart size={18}/>}生成采购单</button>
    </div></section>
    <section className="grid gap-3">{message?<div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div>:null}{error?<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>:null}
      <div className="grid gap-3 md:hidden">{orders.map((o)=><div key={o.id} className="rounded-lg border border-line bg-white p-4"><div className="font-black">{o.orderNo}</div><div className="mt-1 text-sm">{o.supplier}</div><div className="mt-1 text-xs text-ink/60">到货：{o.receivedQty}/{o.orderedQty}</div><div className="mt-2"><StatusBadge status={o.statusText}/></div><div className="mt-3 grid grid-cols-2 gap-2"><button className="btn-secondary min-h-10 px-2" onClick={()=>void flowAction(o,"completePurchase")}>采购完成</button><button className="btn-secondary min-h-10 px-2" onClick={()=>void flowAction(o,"acceptArrival")}>验收通过</button><button className="btn-secondary min-h-10 px-2" onClick={()=>void flowAction(o,"rejectArrival")}>验收拒绝</button><button className="btn-secondary min-h-10 px-2" onClick={()=>void flowAction(o,"remind")}>催货</button></div></div>)}</div>
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-white md:block"><table className="w-full min-w-[1060px] text-left"><thead className="bg-field"><tr>{["采购单","关联申请","供应商","采购员","金额","预计到货","到货进度","状态","操作"].map(c=><th className="px-4 py-3 text-sm font-black" key={c}>{c}</th>)}</tr></thead><tbody className="divide-y divide-line">{orders.map(o=><tr key={o.id}><td className="px-4 py-3 text-sm">{o.orderNo}</td><td className="px-4 py-3 text-sm">{o.requestNo}</td><td className="px-4 py-3 text-sm">{o.supplier}</td><td className="px-4 py-3 text-sm">{o.purchaser}</td><td className="px-4 py-3 text-sm">{o.amount}</td><td className="px-4 py-3 text-sm">{o.expectedArrival}</td><td className="px-4 py-3 text-sm">{o.receivedQty}/{o.orderedQty}</td><td className="px-4 py-3"><StatusBadge status={o.statusText}/></td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button className="btn-secondary min-h-10 px-3" onClick={()=>void flowAction(o,"completePurchase")}><ClipboardCheck size={16}/>采购完成</button><button className="btn-secondary min-h-10 px-3" onClick={()=>void flowAction(o,"acceptArrival")}><CheckCircle2 size={16}/>验收通过</button><button className="btn-secondary min-h-10 px-3" onClick={()=>void flowAction(o,"rejectArrival")}><XCircle size={16}/>验收拒绝</button><button className="btn-secondary min-h-10 px-3" onClick={()=>void flowAction(o,"remind")}><Bell size={16}/>催货</button></div></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
