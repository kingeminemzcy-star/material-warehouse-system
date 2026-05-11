"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, PackagePlus, RefreshCw, Upload } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAuthHeaders } from "@/lib/client-auth";
import { inferMaterialCategory } from "@/lib/material-code";

type Project = { id: string; name: string; code: string };
type BomInputRow = { drawingNo: string; materialName: string; spec: string; material: string; unit: string; quantity: number; remark: string };
type BomAnalysisRow = BomInputRow & { id: string; materialCode: string; matchedMaterialId?: string; matchedSpecId?: string; currentStock: number; shortageQty: number; matchStatus: string };
type Bom = { id: string; drawingNo: string; version: string; isCurrent: boolean; uploadedAt: string; rows: BomInputRow[]; analysis: BomAnalysisRow[] };

const headerMap = {
  drawingNo: ["图号", "drawingNo", "drawing", "图纸编号"],
  materialName: ["材料名称", "名称", "物料名称", "材料", "materialName"],
  spec: ["规格", "规格型号", "型号", "spec"],
  material: ["材质", "material"],
  unit: ["单位", "unit"],
  quantity: ["数量", "需求数量", "qty", "quantity"],
  remark: ["备注", "remark", "说明"]
};

function parseCsv(text: string) {
  return text.split(/\r?\n/).map((line) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else current += char;
    }
    cells.push(current.trim());
    return cells.map((cell) => cell.replace(/^"|"$/g, ""));
  }).filter((row) => row.some(Boolean));
}

function pick(row: string[], headers: string[], key: keyof typeof headerMap) {
  const index = headers.findIndex((header) => headerMap[key].some((alias) => alias.toLowerCase() === header.trim().toLowerCase()));
  return index >= 0 ? row[index] ?? "" : "";
}

function toBomRows(table: string[][]): BomInputRow[] {
  const [headerRow, ...rows] = table;
  const headers = headerRow ?? [];
  return rows.map((row) => ({
    drawingNo: pick(row, headers, "drawingNo"),
    materialName: pick(row, headers, "materialName"),
    spec: pick(row, headers, "spec"),
    material: pick(row, headers, "material"),
    unit: pick(row, headers, "unit") || "件",
    quantity: Number(pick(row, headers, "quantity") || 0),
    remark: pick(row, headers, "remark")
  })).filter((row) => row.drawingNo && row.materialName && row.quantity > 0);
}

export function BomClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [boms, setBoms] = useState<Bom[]>([]);
  const [rows, setRows] = useState<BomInputRow[]>([]);
  const [version, setVersion] = useState("A");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const drawingNo = rows[0]?.drawingNo ?? "";
  const currentBom = useMemo(() => boms.find((bom) => bom.isCurrent) ?? boms[0], [boms]);

  async function loadProjects() {
    const payload = await fetch("/api/projects", { headers: await getAuthHeaders(), cache: "no-store" }).then((res) => res.json());
    setProjects(payload.projects ?? []);
  }

  async function loadBoms(nextProjectId = projectId) {
    if (!nextProjectId) return;
    const payload = await fetch(`/api/bom?projectId=${encodeURIComponent(nextProjectId)}`, { headers: await getAuthHeaders(), cache: "no-store" }).then((res) => res.json());
    if (payload.error) {
      setError(payload.error);
      return;
    }
    setBoms(payload.boms ?? []);
  }

  async function parseFile(file: File) {
    setError(null);
    setMessage(null);
    if (/\.xlsx?$/i.test(file.name)) {
      const readXlsxFile = (await import("read-excel-file/browser")).default;
      const table = await readXlsxFile(file) as unknown as Array<Array<unknown>>;
      setRows(toBomRows(table.map((row) => row.map((cell) => String(cell ?? "")))));
      return;
    }
    const text = await file.text();
    setRows(toBomRows(parseCsv(text)));
  }

  async function uploadBom() {
    if (!projectId) return setError("请选择工程项目。");
    if (!rows.length) return setError("请先上传 BOM 文件。");
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/bom", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ projectId, drawingNo, version, rows })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "BOM 上传失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "BOM 已上传。");
    setRows([]);
    await loadBoms();
    setBusy(false);
  }

  async function bomAction(bomId: string, action: "setCurrent" | "generatePurchase") {
    if (!window.confirm(action === "setCurrent" ? "确认切换当前 BOM 版本？" : "确认按 BOM 缺料生成采购申请？")) return;
    const reason = action === "generatePurchase" ? window.prompt("请输入生成采购申请原因", "BOM缺料采购") : "切换当前BOM版本";
    if (!reason?.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/bom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ projectId, bomId, action, confirmed: true, reason })
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "BOM 操作失败。");
    else setMessage(payload.message || "操作已完成。");
    await loadBoms();
    setBusy(false);
  }

  async function createMaterial(row: BomAnalysisRow) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ name: row.materialName, category: inferMaterialCategory(`${row.materialName} ${row.spec}`), spec: row.spec, material: row.material, dimensions: "", unit: row.unit })
    });
    const payload = await response.json();
    if (!response.ok && response.status !== 409) setError(payload.error || "材料创建失败。");
    else setMessage(response.status === 409 ? "材料已存在，请重新上传或刷新 BOM 匹配。" : "材料已创建，请重新上传或刷新 BOM 匹配。");
    setBusy(false);
  }

  useEffect(() => { void loadProjects(); }, []);

  return (
    <div className="grid gap-5">
      {message ? <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="grid gap-2">
            <span className="form-label">工程项目</span>
            <select className="field" value={projectId} onChange={(event) => { setProjectId(event.target.value); void loadBoms(event.target.value); }}>
              <option value="">请选择项目</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.code} / {project.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="form-label">BOM 版本</span>
            <input className="field w-32" value={version} onChange={(event) => setVersion(event.target.value)} />
          </label>
          <button className="btn-secondary min-h-11 px-3" disabled={!projectId} onClick={() => void loadBoms()}>
            <RefreshCw size={17} />
            刷新
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-black text-ink">上传 BOM</h2>
          <p className="mt-1 text-sm text-ink/55">支持 `.xlsx`、`.xls`、`.csv`，字段会自动识别。</p>
          <label className="btn-secondary mt-4 min-h-14 cursor-pointer">
            <FileSpreadsheet size={20} />
            选择 Excel / CSV
            <input className="hidden" type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseFile(file); }} />
          </label>
          <button className="btn-primary mt-3 min-h-12 w-full" disabled={busy || !rows.length || !projectId} onClick={() => void uploadBom()}>
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            上传并解析 BOM
          </button>
          <div className="mt-4 rounded-md bg-field px-3 py-3 text-xs font-semibold text-ink/58">
            标准字段：图号、材料名称、规格、材质、单位、数量、备注。
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-black text-ink">上传预览</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-field"><tr>{["图号","材料名称","规格","材质","单位","数量","备注"].map((item,index)=><th key={`${item}-${index}`} className="px-4 py-3 text-sm font-black">{item}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-ink/60">暂无上传预览</td></tr> : null}
                {rows.map((row, index) => <tr key={`${row.drawingNo}-${row.materialName}-${index}`}><td className="px-4 py-3 text-sm">{row.drawingNo}</td><td className="px-4 py-3 text-sm">{row.materialName}</td><td className="px-4 py-3 text-sm">{row.spec}</td><td className="px-4 py-3 text-sm">{row.material}</td><td className="px-4 py-3 text-sm">{row.unit}</td><td className="px-4 py-3 text-sm">{row.quantity}</td><td className="px-4 py-3 text-sm">{row.remark}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-black text-ink">BOM 版本与缺料分析</h2>
          {currentBom ? <div className="text-sm font-semibold text-ink/60">当前：{currentBom.drawingNo} / {currentBom.version}</div> : null}
        </div>
        <div className="mt-4 grid gap-3">
          {boms.length === 0 ? <div className="rounded-md bg-field px-4 py-10 text-center text-sm text-ink/60">请选择项目并上传 BOM。</div> : null}
          {boms.map((bom) => (
            <div key={bom.id} className="rounded-lg border border-line">
              <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-black text-ink">{bom.drawingNo} / {bom.version}</div>
                  <div className="mt-1 text-xs text-ink/55">上传时间：{bom.uploadedAt?.slice(0, 16)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={bom.isCurrent ? "当前版本" : "历史版本"} />
                  <button className="btn-secondary min-h-10 px-3" disabled={busy || bom.isCurrent} onClick={() => void bomAction(bom.id, "setCurrent")}>设为当前</button>
                  <button className="btn-primary min-h-10 px-3" disabled={busy} onClick={() => void bomAction(bom.id, "generatePurchase")}>一键生成采购申请</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead className="bg-field"><tr>{["材料编码","材料","规格/材质","需求数量","当前库存","缺口","匹配状态","操作"].map((item,index)=><th key={`${bom.id}-${index}`} className="px-4 py-3 text-sm font-black">{item}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {bom.analysis.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-xs font-semibold text-ink/60">{row.materialCode}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{row.materialName}</td>
                        <td className="px-4 py-3 text-sm text-ink/70">{[row.material,row.spec].filter(Boolean).join(" / ")}</td>
                        <td className="px-4 py-3 text-sm">{row.quantity} {row.unit}</td>
                        <td className="px-4 py-3 text-sm">{row.currentStock} {row.unit}</td>
                        <td className={`px-4 py-3 text-sm font-black ${row.shortageQty > 0 ? "text-red-700" : "text-blue-800"}`}>{row.shortageQty} {row.unit}</td>
                        <td className="px-4 py-3 text-sm"><StatusBadge status={row.matchStatus} /></td>
                        <td className="px-4 py-3">{row.matchStatus === "未匹配" ? <button className="btn-secondary min-h-10 px-3" disabled={busy} onClick={() => void createMaterial(row)}><PackagePlus size={16}/>创建材料</button> : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
