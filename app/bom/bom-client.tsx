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
type BomParseIssue = { fileName: string; line: number; reason: string };
type BomColumnKey = "ignore" | "projectCode" | "applicant" | "date" | "drawingNo" | "sequence" | "materialName" | "spec" | "brand" | "material" | "unit" | "quantity" | "stock" | "remark";
type BomMapping = Record<number, BomColumnKey>;
type ParsedBomTable = { fileName: string; rows: string[][]; headerIndex: number; headers: string[]; mapping: BomMapping; projectCode: string; issues: BomParseIssue[] };

const BOM_MAPPING_TEMPLATE_KEY = "warehouse-bom-mapping-template-v1";

const fieldOptions: Array<{ key: BomColumnKey; label: string }> = [
  { key: "ignore", label: "忽略" },
  { key: "projectCode", label: "项目编码" },
  { key: "applicant", label: "填单人" },
  { key: "date", label: "日期" },
  { key: "drawingNo", label: "图号/部位" },
  { key: "sequence", label: "序号" },
  { key: "materialName", label: "材料名称" },
  { key: "spec", label: "规格" },
  { key: "brand", label: "品牌" },
  { key: "material", label: "材质" },
  { key: "unit", label: "单位" },
  { key: "quantity", label: "数量" },
  { key: "stock", label: "库存" },
  { key: "remark", label: "备注" }
];

const headerMap: Record<Exclude<BomColumnKey, "ignore">, string[]> = {
  projectCode: ["项目号", "项目编号", "项目编码", "工程号", "工程编号", "projectCode"],
  applicant: ["填单人", "申请人", "制表人", "编制人"],
  date: ["日期", "填单日期", "制表日期"],
  drawingNo: ["图号", "部件位", "部位", "位置", "drawingNo", "drawing", "图纸编号"],
  sequence: ["序号", "编号", "no"],
  materialName: ["材料名称", "名称", "物料名称", "材料", "materialName"],
  spec: ["规格", "规格型号", "型号", "spec"],
  brand: ["品牌", "厂家", "制造商"],
  material: ["材质", "material"],
  unit: ["单位", "unit"],
  quantity: ["数量", "需求数量", "qty", "quantity"],
  stock: ["库存", "库存数量", "现有库存"],
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
  });
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[\s:：/\\|｜\-_.()（）[\]【】]/g, "");
}

function matchHeader(cell: string): BomColumnKey {
  const normalizedCell = normalizeText(cell);
  if (!normalizedCell) return "ignore";
  for (const [key, aliases] of Object.entries(headerMap) as Array<[Exclude<BomColumnKey, "ignore">, string[]]>) {
    if (aliases.some((alias) => normalizeText(alias) === normalizedCell)) return key;
  }
  return "ignore";
}

function getFieldLabel(key: BomColumnKey) {
  return fieldOptions.find((option) => option.key === key)?.label ?? "忽略";
}

function readStoredMapping(): BomMapping | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(BOM_MAPPING_TEMPLATE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Record<string, BomColumnKey>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [Number(key), value])) as BomMapping;
  } catch {
    return null;
  }
}

function saveStoredMapping(mapping: BomMapping) {
  window.localStorage.setItem(BOM_MAPPING_TEMPLATE_KEY, JSON.stringify(mapping));
}

function normalizeTableRow(row: unknown, line: number, fileName: string): { row?: string[]; issue?: BomParseIssue } {
  if (Array.isArray(row)) {
    const cells = row.map((cell) => String(cell ?? "").trim());
    return cells.some(Boolean) ? { row: cells } : { issue: { fileName, line, reason: "空行已跳过" } };
  }
  if (row && typeof row === "object") {
    const cells = Object.values(row as Record<string, unknown>).map((cell) => String(cell ?? "").trim());
    return cells.some(Boolean) ? { row: cells } : { issue: { fileName, line, reason: "对象行为空，已跳过" } };
  }
  if (row == null || row === "") {
    return { issue: { fileName, line, reason: "空行已跳过" } };
  }
  return { issue: { fileName, line, reason: `无效行类型 ${typeof row}，已跳过` } };
}

function normalizeTable(table: unknown, fileName: string): { rows: string[][]; issues: BomParseIssue[] } {
  if (!Array.isArray(table)) {
    return { rows: [], issues: [{ fileName, line: 0, reason: "文件解析结果不是表格结构" }] };
  }
  const rows: string[][] = [];
  const issues: BomParseIssue[] = [];
  table.forEach((row, index) => {
    const result = normalizeTableRow(row, index + 1, fileName);
    if (result.row) rows.push(result.row);
    if (result.issue && result.issue.reason !== "空行已跳过") issues.push(result.issue);
  });
  return { rows, issues };
}

function extractProjectCode(rows: string[][], headerIndex: number) {
  for (let rowIndex = 0; rowIndex < Math.max(headerIndex, 0); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const cell = row[cellIndex] ?? "";
      if (normalizeText(cell).includes("项目号") || normalizeText(cell).includes("项目编号") || normalizeText(cell).includes("项目编码")) {
        const inlineValue = cell.split(/[:：]/)[1]?.trim();
        if (inlineValue) return inlineValue;
        const nextValue = row[cellIndex + 1]?.trim();
        if (nextValue) return nextValue;
      }
    }
  }
  return "";
}

function scoreHeaderRow(row: string[]) {
  const matched = row.map(matchHeader);
  const score = matched.filter((key) => key !== "ignore").length;
  const hasName = matched.includes("materialName");
  const hasQuantity = matched.includes("quantity");
  const hasSpec = matched.includes("spec");
  const hasSequence = matched.includes("sequence");
  return { score: score + (hasName ? 2 : 0) + (hasQuantity ? 2 : 0) + (hasSpec ? 1 : 0) + (hasSequence ? 1 : 0), matched, hasName, hasQuantity };
}

function detectBomTable(rows: string[][], fileName: string): ParsedBomTable {
  let best = { index: -1, score: 0, matched: [] as BomColumnKey[], hasName: false, hasQuantity: false };
  rows.forEach((row, index) => {
    const result = scoreHeaderRow(row);
    if (result.score > best.score) best = { index, ...result };
  });
  const issues: BomParseIssue[] = [];
  if (best.index < 0 || best.score < 4 || !best.hasName || !best.hasQuantity) {
    issues.push({ fileName, line: best.index >= 0 ? best.index + 1 : 0, reason: "未自动识别到包含名称和数量的 BOM 表头" });
  }
  const headers = rows[best.index] ?? [];
  const detectedMapping = Object.fromEntries(headers.map((header, index) => [index, matchHeader(header)])) as BomMapping;
  const storedMapping = readStoredMapping();
  const mapping = storedMapping && Object.keys(storedMapping).length === headers.length ? storedMapping : detectedMapping;
  return {
    fileName,
    rows,
    headerIndex: best.index,
    headers,
    mapping,
    projectCode: extractProjectCode(rows, best.index),
    issues
  };
}

function valueByMapping(row: string[], mapping: BomMapping, key: BomColumnKey) {
  const index = Object.entries(mapping).find(([, value]) => value === key)?.[0];
  if (index == null) return "";
  return row[Number(index)] ?? "";
}

function parseQuantity(value: string) {
  const normalized = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/)?.[0] ?? "";
  return Number(normalized);
}

function buildRowsFromMapping(table: ParsedBomTable, mapping: BomMapping): { rows: BomInputRow[]; issues: BomParseIssue[] } {
  if (table.headerIndex < 0 || !table.headers.length) {
    return { rows: [], issues: [{ fileName: table.fileName, line: 0, reason: "未识别到真实表头，无法生成 BOM 明细" }] };
  }
  const parsedRows: BomInputRow[] = [];
  const issues: BomParseIssue[] = [];
  let lastDrawingNo = "";
  table.rows.slice(table.headerIndex + 1).forEach((row, index) => {
    const line = table.headerIndex + index + 2;
    if (!row.some(Boolean)) return;
    const materialName = valueByMapping(row, mapping, "materialName");
    const quantityText = valueByMapping(row, mapping, "quantity");
    const quantity = parseQuantity(quantityText);
    const mappedDrawingNo = valueByMapping(row, mapping, "drawingNo");
    if (mappedDrawingNo) lastDrawingNo = mappedDrawingNo;
    if (!materialName && !quantityText && !valueByMapping(row, mapping, "spec")) return;
    const brand = valueByMapping(row, mapping, "brand");
    const stock = valueByMapping(row, mapping, "stock");
    const remarkParts = [
      valueByMapping(row, mapping, "remark"),
      brand ? `品牌：${brand}` : "",
      stock ? `库存：${stock}` : "",
      table.projectCode ? `项目号：${table.projectCode}` : ""
    ].filter(Boolean);
    const parsedRow = {
      drawingNo: mappedDrawingNo || lastDrawingNo || table.projectCode || "未分部位",
      materialName,
      spec: valueByMapping(row, mapping, "spec"),
      material: valueByMapping(row, mapping, "material"),
      unit: valueByMapping(row, mapping, "unit") || "件",
      quantity,
      remark: remarkParts.join("；")
    };
    if (!parsedRow.materialName) {
      issues.push({ fileName: table.fileName, line, reason: "缺少名称字段，已跳过" });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      issues.push({ fileName: table.fileName, line, reason: `数量无效：${quantityText || "空"}，已跳过` });
      return;
    }
    parsedRows.push(parsedRow);
  });
  if (!Object.values(mapping).includes("materialName")) {
    issues.unshift({ fileName: table.fileName, line: table.headerIndex + 1, reason: "缺失字段：名称/材料名称" });
  }
  if (!Object.values(mapping).includes("quantity")) {
    issues.unshift({ fileName: table.fileName, line: table.headerIndex + 1, reason: "缺失字段：数量" });
  }
  return { rows: parsedRows, issues };
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
  const [fileName, setFileName] = useState("");
  const [parseIssues, setParseIssues] = useState<BomParseIssue[]>([]);
  const [parsedTable, setParsedTable] = useState<ParsedBomTable | null>(null);
  const [mapping, setMapping] = useState<BomMapping>({});

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
    setRows([]);
    setParseIssues([]);
    setParsedTable(null);
    setMapping({});
    setFileName(file.name);
    try {
      const rawTable = /\.xlsx?$/i.test(file.name)
        ? await (await import("read-excel-file/browser")).default(file)
        : parseCsv(await file.text());
      const normalized = normalizeTable(rawTable, file.name);
      const nextTable = detectBomTable(normalized.rows, file.name);
      const parsed = buildRowsFromMapping(nextTable, nextTable.mapping);
      const nextIssues = [...normalized.issues, ...nextTable.issues, ...parsed.issues];
      setParsedTable(nextTable);
      setMapping(nextTable.mapping);
      setRows(parsed.rows);
      setParseIssues(nextIssues);
      if (!parsed.rows.length) {
        setError(`文件 ${file.name} 未解析到有效 BOM 明细，请检查表头识别和字段映射。`);
        return;
      }
      setMessage(`文件 ${file.name} 解析完成，识别表头在第 ${nextTable.headerIndex + 1} 行，预览 ${parsed.rows.length} 行${nextIssues.length ? `，跳过 ${nextIssues.length} 行` : ""}。`);
    } catch (caughtError) {
      const reason = caughtError instanceof Error ? caughtError.message : "未知解析错误";
      setRows([]);
      setParseIssues([{ fileName: file.name, line: 0, reason }]);
      setError(`文件 ${file.name} 解析失败：${reason}`);
    }
  }

  function applyMapping(nextMapping: BomMapping, shouldSave = false) {
    setMapping(nextMapping);
    if (!parsedTable) return;
    if (shouldSave) saveStoredMapping(nextMapping);
    const parsed = buildRowsFromMapping(parsedTable, nextMapping);
    const nextIssues = [...parsedTable.issues, ...parsed.issues];
    setRows(parsed.rows);
    setParseIssues(nextIssues);
    if (!parsed.rows.length) {
      setError("当前字段映射未生成有效 BOM 明细，请检查名称和数量字段。");
      setMessage(null);
      return;
    }
    setError(null);
    setMessage(`${shouldSave ? "字段映射模板已保存，" : ""}当前映射生成 ${parsed.rows.length} 行有效 BOM 明细${nextIssues.length ? `，跳过 ${nextIssues.length} 行` : ""}。`);
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
            支持打印版工程 BOM：可自动跳过公司页眉、Logo、说明文字、空行和分页区域，并识别中间真实表头。
          </div>
          {parsedTable ? (
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-xs font-semibold text-blue-950">
              <div className="text-sm font-black">识别结果</div>
              <div className="mt-2 grid gap-1 text-blue-900/75">
                <div>真实表头：第 {parsedTable.headerIndex + 1} 行</div>
                <div>项目号：{parsedTable.projectCode || "未识别"}</div>
                <div>原始字段：{parsedTable.headers.filter(Boolean).join(" / ")}</div>
              </div>
            </div>
          ) : null}
          {parseIssues.length ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-900">
              <div className="mb-2 text-sm font-black">解析提示</div>
              <div className="grid gap-1">
                {parseIssues.slice(0, 8).map((issue, index) => (
                  <div key={`${issue.fileName}-${issue.line}-${index}`}>{issue.fileName} 第 {issue.line || "-"} 行：{issue.reason}</div>
                ))}
                {parseIssues.length > 8 ? <div>还有 {parseIssues.length - 8} 条提示未显示。</div> : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-line bg-white p-4">
          {parsedTable ? (
            <div className="mb-5 rounded-lg border border-line bg-field/50 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-ink">字段映射预览</h2>
                  <p className="mt-1 text-sm font-semibold text-ink/55">自动识别后可手动修改，保存模板后同类型 BOM 会优先套用。</p>
                </div>
                <button className="btn-secondary min-h-10 px-3" type="button" onClick={() => applyMapping(mapping, true)}>保存映射模板</button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {parsedTable.headers.map((header, index) => (
                  <label key={`${header}-${index}`} className="grid gap-2 rounded-md border border-line bg-white p-3">
                    <span className="text-xs font-black text-ink/55">第 {index + 1} 列：{header || "空列"}</span>
                    <select
                      className="field"
                      value={mapping[index] ?? "ignore"}
                      onChange={(event) => applyMapping({ ...mapping, [index]: event.target.value as BomColumnKey })}
                    >
                      {fieldOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink/55">
                {Object.entries(mapping).filter(([, value]) => value !== "ignore").map(([index, value]) => (
                  <span key={`${index}-${value}`} className="rounded-full bg-white px-3 py-1">第 {Number(index) + 1} 列 → {getFieldLabel(value)}</span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <h2 className="text-lg font-black text-ink">上传预览</h2>
            {fileName ? <div className="text-sm font-semibold text-ink/55">{fileName} / {rows.length} 行有效数据</div> : null}
          </div>
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
