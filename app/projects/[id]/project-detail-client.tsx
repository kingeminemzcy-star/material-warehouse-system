"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Loader2, PackageMinus, PackagePlus, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAuthHeaders } from "@/lib/client-auth";

type Drawing = { id: string; drawingNo: string; name: string; version: string; remark: string; voided?: boolean; voidReason?: string; bomCount?: number; purchaseQty?: number; outboundQty?: number; returnQty?: number };
type BomItem = { id: string; drawingNo: string; version: string; isCurrent: boolean; uploadedAt: string; uploadedByName?: string; projectCode?: string; orderPerson?: string; orderDate?: string; rows: unknown[] };
type SummaryItem = {
  drawingId: string;
  drawing: string;
  materialId: string;
  specId: string;
  materialName: string;
  spec: string;
  material: string;
  dimensions: string;
  purchasedQty: number;
  inboundQty: number;
  outboundQty: number;
  returnQty: number;
  remainingQty: number;
  currentStockQty: number;
  unit: string;
  status: string;
};
type RecordItem = { id: string; outboundNo?: string; inboundNo?: string; drawing: string; material: string; spec: string; quantity: number; unit: string; purpose?: string; operator: string; createdAt: string };
type SummaryPayload = {
  project: { id: string; code: string; name: string; customer: string | null; status: string };
  drawings: Drawing[];
  drawingStats: Drawing[];
  boms: BomItem[];
  summary: SummaryItem[];
  outboundRecords: RecordItem[];
  returnRecords: RecordItem[];
  stats: { purchasedQty: number; inboundQty: number; outboundQty: number; returnQty: number; remainingQty: number; currentStockQty: number; materialCost: number };
};

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [drawingFilter, setDrawingFilter] = useState("全部图号");
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawingForm, setDrawingForm] = useState({ drawingNo: "", name: "", version: "A", remark: "" });
  const [editingDrawingId, setEditingDrawingId] = useState("");
  const [editDrawingForm, setEditDrawingForm] = useState({ drawingNo: "", name: "", version: "A", remark: "" });

  const readonly = data?.project.status === "COMPLETED";

  async function load() {
    setError(null);
    const response = await fetch(`/api/project-summary?projectId=${encodeURIComponent(projectId)}`, { headers: await getAuthHeaders(), cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "项目详情加载失败。");
      return;
    }
    setData(payload);
  }

  async function addDrawing() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/project-drawings", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ projectId, ...drawingForm })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "图号保存失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "图号已保存。");
    setDrawingForm({ drawingNo: "", name: "", version: "A", remark: "" });
    await load();
    setBusy(false);
  }

  function startEditDrawing(drawing: Drawing) {
    setEditingDrawingId(drawing.id);
    setEditDrawingForm({ drawingNo: drawing.drawingNo, name: drawing.name, version: drawing.version, remark: drawing.remark || "" });
  }

  async function drawingAction(drawing: Drawing, action: "update" | "void" | "restore" | "delete") {
    const reason = action === "restore" ? "恢复作废图号" : window.prompt(action === "delete" ? "请输入删除/作废原因" : action === "void" ? "请输入作废原因" : "请输入修改原因", action === "update" ? "录入错误修正" : "");
    if ((action !== "restore" || !reason) && !reason?.trim()) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/project-drawings", {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ projectId, drawingId: drawing.id, action, reason, ...(action === "update" ? editDrawingForm : {}) })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "图号操作失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "图号操作已完成。");
    setEditingDrawingId("");
    await load();
    setBusy(false);
  }

  async function completeProject(forceComplete = false) {
    const reason = window.prompt(forceComplete ? "请填写强制完工原因" : "请填写项目完工备注", "项目材料已核对");
    if (!reason?.trim()) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ id: projectId, action: "complete", reason, forceComplete })
    });
    const payload = await response.json();
    if (!response.ok) {
      if (payload.code === "UNRETURNED_MATERIALS" && window.confirm(`${payload.error}\n\n是否确认没有剩余材料需要退库，并强制完工？`)) {
        setBusy(false);
        await completeProject(true);
        return;
      }
      setError(payload.error || "项目完工失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "项目已完工。");
    await load();
    setBusy(false);
  }

  const filteredSummary = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (data?.summary ?? []).filter((item) => {
      const matchesDrawing = drawingFilter === "全部图号" || item.drawingId === drawingFilter;
      const haystack = [item.drawing, item.materialName, item.spec, item.material, item.dimensions, item.status].join(" ").toLowerCase();
      return matchesDrawing && (!q || haystack.includes(q));
    });
  }, [data, drawingFilter, keyword]);

  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return <div className="rounded-lg border border-line bg-white px-4 py-10 text-center text-sm font-semibold text-ink/60">{error ?? "正在加载项目材料闭环..."}</div>;
  }

  return (
    <div className="grid gap-5">
      {message ? <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-ink/55">{data.project.code}</div>
            <h2 className="mt-1 text-2xl font-black text-ink">{data.project.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/60">
              <span>{data.project.customer ?? "未填写客户"}</span>
              <StatusBadge status={readonly ? "已完成" : "进行中"} />
            </div>
          </div>
          {readonly ? (
            <div className="rounded-md border border-line bg-field px-3 py-2 text-sm font-semibold text-ink/60">项目已完工，当前为只读状态</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Link className="btn-secondary min-h-11 px-3" href={`/purchase-requests?projectId=${projectId}`}>
                <Plus size={17} />
                采购申请
              </Link>
              <Link className="btn-secondary min-h-11 px-3" href={`/outbound?projectId=${projectId}`}>
                <PackageMinus size={17} />
                领料出库
              </Link>
              <Link className="btn-secondary min-h-11 px-3" href={`/inbound?source=PROJECT_RETURN&projectId=${projectId}`}>
                <PackagePlus size={17} />
                项目退料
              </Link>
              <button className="btn-primary min-h-11 px-3" disabled={busy} onClick={() => void completeProject()}>
                {busy ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
                项目完工
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["采购总量", data.stats.purchasedQty],
          ["领料总量", data.stats.outboundQty],
          ["退料总量", data.stats.returnQty],
          ["剩余材料", data.stats.remainingQty],
          ["当前库存占用", data.stats.currentStockQty]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-white p-4">
            <div className="text-sm font-semibold text-ink/55">{label}</div>
            <div className="mt-2 text-3xl font-black text-blue-800">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h3 className="text-lg font-black text-ink">图号分区</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {data.drawingStats.length === 0 ? <div className="rounded-md bg-field px-3 py-3 text-sm text-ink/60">暂无图号，请先添加图号后再办理采购和领料。</div> : null}
          {data.drawingStats.map((drawing) => (
            <div key={drawing.id} className={`rounded-md border px-3 py-3 ${drawing.voided ? "border-amber-200 bg-amber-50" : "border-line bg-white"}`}>
              {editingDrawingId === drawing.id ? (
                <div className="grid gap-2">
                  <input className="field" value={editDrawingForm.drawingNo} onChange={(event) => setEditDrawingForm({ ...editDrawingForm, drawingNo: event.target.value })} />
                  <input className="field" value={editDrawingForm.name} onChange={(event) => setEditDrawingForm({ ...editDrawingForm, name: event.target.value })} />
                  <input className="field" value={editDrawingForm.version} onChange={(event) => setEditDrawingForm({ ...editDrawingForm, version: event.target.value })} />
                  <input className="field" value={editDrawingForm.remark} onChange={(event) => setEditDrawingForm({ ...editDrawingForm, remark: event.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary min-h-10 px-3" disabled={busy} onClick={() => void drawingAction(drawing, "update")}><Save size={16} />保存修改</button>
                    <button className="btn-secondary min-h-10 px-3" onClick={() => setEditingDrawingId("")}>取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-black text-ink">{drawing.drawingNo}{drawing.voided ? "（已作废）" : ""}</div>
                      <div className="mt-1 text-sm text-ink/70">{drawing.name} / {drawing.version}</div>
                      {drawing.remark ? <div className="mt-1 text-xs text-ink/50">{drawing.remark}</div> : null}
                      {drawing.voidReason ? <div className="mt-1 text-xs font-semibold text-amber-800">作废原因：{drawing.voidReason}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary min-h-9 px-2 text-sm" disabled={readonly || busy} onClick={() => startEditDrawing(drawing)}><Pencil size={15} />编辑</button>
                      {drawing.voided ? (
                        <button className="btn-secondary min-h-9 px-2 text-sm" disabled={busy} onClick={() => void drawingAction(drawing, "restore")}><RotateCcw size={15} />恢复</button>
                      ) : (
                        <button className="btn-secondary min-h-9 px-2 text-sm" disabled={busy} onClick={() => void drawingAction(drawing, "void")}><Ban size={15} />作废</button>
                      )}
                      <button className="btn-secondary min-h-9 px-2 text-sm" disabled={busy} onClick={() => void drawingAction(drawing, "delete")}><Trash2 size={15} />删除</button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-semibold text-ink/60">
                    <div className="rounded bg-field py-2">BOM {drawing.bomCount ?? 0}</div>
                    <div className="rounded bg-field py-2">采购 {drawing.purchaseQty ?? 0}</div>
                    <div className="rounded bg-field py-2">领料 {drawing.outboundQty ?? 0}</div>
                    <div className="rounded bg-field py-2">退料 {drawing.returnQty ?? 0}</div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <input className="field" disabled={readonly} placeholder="图号" value={drawingForm.drawingNo} onChange={(event) => setDrawingForm({ ...drawingForm, drawingNo: event.target.value })} />
          <input className="field" disabled={readonly} placeholder="图纸名称" value={drawingForm.name} onChange={(event) => setDrawingForm({ ...drawingForm, name: event.target.value })} />
          <input className="field" disabled={readonly} placeholder="版本号" value={drawingForm.version} onChange={(event) => setDrawingForm({ ...drawingForm, version: event.target.value })} />
          <input className="field" disabled={readonly} placeholder="备注" value={drawingForm.remark} onChange={(event) => setDrawingForm({ ...drawingForm, remark: event.target.value })} />
          <button className="btn-primary min-h-11" disabled={busy || readonly} onClick={() => void addDrawing()}>
            {busy ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}
            添加图号
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h3 className="text-lg font-black text-ink">BOM 清单</h3>
        <div className="mt-3 grid gap-2">
          {data.boms.length === 0 ? <div className="rounded-md bg-field px-3 py-6 text-center text-sm text-ink/60">暂无 BOM。</div> : null}
          {data.boms.map((bom) => (
            <div key={bom.id} className="rounded-md border border-line px-3 py-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="font-black text-ink">{bom.drawingNo} / {bom.version}</div>
                <StatusBadge status={bom.isCurrent ? "当前版本" : "历史版本"} />
              </div>
              <div className="mt-1 text-sm text-ink/60">项目号：{bom.projectCode || data.project.code} / 下单人：{bom.orderPerson || "-"} / 下单日期：{bom.orderDate || "-"} / 上传人：{bom.uploadedByName || "-"} / 上传时间：{bom.uploadedAt?.slice(0, 16)}</div>
              <div className="mt-1 text-xs text-ink/50">BOM 明细：{bom.rows.length} 行</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-lg font-black text-ink">项目采购清单</h3>
            <div className="grid gap-2 md:grid-cols-2">
              <select className="field" value={drawingFilter} onChange={(event) => setDrawingFilter(event.target.value)}>
                <option>全部图号</option>
                {data.drawings.map((drawing) => (
                  <option key={drawing.id} value={drawing.id}>{drawing.drawingNo} / {drawing.name}</option>
                ))}
              </select>
              <input className="field" placeholder="材料/规格/状态" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-field">
                <tr>{["图号", "材料", "规格", "采购数量", "已入库", "已领料", "已退料", "剩余", "库存占用"].map((column, index) => <th key={`${column}-${index}`} className="px-4 py-3 text-sm font-black text-ink">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredSummary.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-ink/60">暂无匹配数据</td></tr> : null}
                {filteredSummary.map((item, index) => (
                  <tr key={`${item.drawingId}-${item.materialId}-${item.specId}-${index}`}>
                    <td className="px-4 py-3 text-sm text-ink/70">{item.drawing}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-ink">{item.materialName}</td>
                    <td className="px-4 py-3 text-sm text-ink/70">{[item.material, item.spec, item.dimensions].filter(Boolean).join(" / ")}</td>
                    <td className="px-4 py-3 text-sm">{item.purchasedQty} {item.unit}</td>
                    <td className="px-4 py-3 text-sm">{item.inboundQty} {item.unit}</td>
                    <td className="px-4 py-3 text-sm">{item.outboundQty} {item.unit}</td>
                    <td className="px-4 py-3 text-sm">{item.returnQty} {item.unit}</td>
                    <td className="px-4 py-3 text-sm font-black text-blue-800">{item.remainingQty} {item.unit}</td>
                    <td className="px-4 py-3 text-sm">{item.currentStockQty} {item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <RecordList title="项目领料记录" empty="暂无领料记录" records={data.outboundRecords} />
        <RecordList title="项目退料记录" empty="暂无退料记录" records={data.returnRecords} />
      </section>
    </div>
  );
}

function RecordList({ title, empty, records }: { title: string; empty: string; records: RecordItem[] }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h3 className="text-lg font-black text-ink">{title}</h3>
      <div className="mt-3 grid gap-2">
        {records.length === 0 ? <div className="rounded-md bg-field px-3 py-6 text-center text-sm text-ink/60">{empty}</div> : null}
        {records.map((record) => (
          <div key={record.id} className="rounded-md border border-line px-3 py-3">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div className="font-black text-ink">{record.material} {record.spec}</div>
              <div className="text-sm font-semibold text-blue-800">{record.quantity} {record.unit}</div>
            </div>
            <div className="mt-1 text-sm text-ink/60">{record.drawing} / {record.operator} / {record.createdAt?.slice(0, 16)}</div>
            {record.purpose ? <div className="mt-1 text-xs text-ink/50">用途：{record.purpose}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
