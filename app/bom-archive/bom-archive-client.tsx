"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArchiveRestore, ChevronDown, ChevronRight, Download, Eye, FileSpreadsheet, PackageSearch, Search, Send, Trash2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/client-auth";
import { responseError, responseMessage, safeJson } from "@/lib/client-safe-json";

type BomRow = {
  id: string;
  drawingNo: string;
  materialName: string;
  spec: string;
  material: string;
  unit: string;
  quantity: number;
  remark: string;
  materialCode: string;
};

type BomAnalysisRow = BomRow & {
  currentStock: number;
  shortageQty: number;
  matchStatus: string;
  skippedReason?: string;
};

type LinkedPurchaseRequest = {
  id: string;
  requestNo: string;
  status: string;
  purpose: string;
  createdAt: string;
};

type BomLog = {
  id: string;
  action: string;
  remark: string | null;
  createdAt: string;
  actor?: { name?: string | null } | null;
};

type ArchiveBom = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  projectStatus: string;
  drawingId: string;
  drawingNo: string;
  drawingName: string;
  drawingVersion: string;
  drawingRemark: string;
  drawingVoided: boolean;
  fileName?: string;
  version: string;
  isCurrent: boolean;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName?: string;
  orderPerson?: string;
  orderDate?: string;
  voided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  restoredAt?: string;
  purchaseGeneratedAt?: string;
  purchaseRequestIds?: string[];
  detailCount: number;
  shortageCount: number;
  shortageQty: number;
  rows: BomRow[];
  analysis: BomAnalysisRow[];
  linkedPurchaseRequests: LinkedPurchaseRequest[];
  logs: BomLog[];
};

type ProjectGroup = {
  project: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  boms: ArchiveBom[];
};

type ArchivePayload = {
  ok?: boolean;
  projects?: ProjectGroup[];
  boms?: ArchiveBom[];
};

type Filters = {
  keyword: string;
  projectId: string;
  drawingNo: string;
  orderPerson: string;
  uploadedDate: string;
  orderDate: string;
  version: string;
  hasShortage: string;
  purchaseGenerated: string;
};

const emptyFilters: Filters = {
  keyword: "",
  projectId: "",
  drawingNo: "",
  orderPerson: "",
  uploadedDate: "",
  orderDate: "",
  version: "",
  hasShortage: "",
  purchaseGenerated: ""
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function includesText(value: unknown, keyword: string) {
  return String(value ?? "").toLowerCase().includes(keyword);
}

function exportBomCsv(bom: ArchiveBom) {
  const headers = ["图号", "材料名称", "规格型号", "材质", "单位", "数量", "当前库存", "缺口数量", "备注"];
  const lines = [headers, ...bom.analysis.map((row) => [row.drawingNo, row.materialName, row.spec, row.material, row.unit, row.quantity, row.currentStock, row.shortageQty, row.remark])];
  const csv = lines.map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${bom.fileName || bom.drawingNo || "bom"}-${bom.version}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function bomMatchesFilter(bom: ArchiveBom, filters: Filters) {
  const keyword = filters.keyword.trim().toLowerCase();
  if (keyword) {
    const rowMatched = bom.rows.some((row) => includesText(row.materialName, keyword) || includesText(row.spec, keyword));
    const baseMatched = [
      bom.projectCode,
      bom.projectName,
      bom.drawingNo,
      bom.drawingName,
      bom.fileName,
      bom.orderPerson,
      bom.uploadedByName,
      bom.version
    ].some((value) => includesText(value, keyword));
    if (!baseMatched && !rowMatched) return false;
  }
  if (filters.projectId && bom.projectId !== filters.projectId) return false;
  if (filters.drawingNo && bom.drawingNo !== filters.drawingNo) return false;
  if (filters.orderPerson && bom.orderPerson !== filters.orderPerson) return false;
  if (filters.version && bom.version !== filters.version) return false;
  if (filters.uploadedDate && formatDate(bom.uploadedAt) !== filters.uploadedDate) return false;
  if (filters.orderDate && formatDate(bom.orderDate) !== filters.orderDate) return false;
  if (filters.hasShortage === "yes" && bom.shortageCount <= 0) return false;
  if (filters.hasShortage === "no" && bom.shortageCount > 0) return false;
  if (filters.purchaseGenerated === "yes" && !bom.purchaseGeneratedAt && bom.linkedPurchaseRequests.length === 0) return false;
  if (filters.purchaseGenerated === "no" && (bom.purchaseGeneratedAt || bom.linkedPurchaseRequests.length > 0)) return false;
  return true;
}

export function BomArchiveClient() {
  const [payload, setPayload] = useState<ArchivePayload>({});
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedDrawings, setExpandedDrawings] = useState<Set<string>>(new Set());
  const [expandedBoms, setExpandedBoms] = useState<Set<string>>(new Set());
  const [selectedBomId, setSelectedBomId] = useState("");
  const boms = payload.boms ?? [];

  async function loadArchive() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/bom-archive", { headers: await getAuthHeaders(), cache: "no-store" });
    const body = (await safeJson(response)) as ArchivePayload | null;
    if (!response.ok || !body?.ok) {
      setError(responseError(body, "BOM 档案加载失败。"));
      setLoading(false);
      return;
    }
    setPayload(body);
    const latest = [...(body.boms ?? [])].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
    if (latest) {
      setExpandedProjects(new Set([latest.projectId]));
      setExpandedDrawings(new Set([`${latest.projectId}:${latest.drawingNo}`]));
      setExpandedBoms(new Set([latest.id]));
      setSelectedBomId(latest.id);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadArchive();
  }, []);

  const filteredBoms = useMemo(() => boms.filter((bom) => bomMatchesFilter(bom, filters)), [boms, filters]);
  const selectedBom = useMemo(() => filteredBoms.find((bom) => bom.id === selectedBomId) ?? filteredBoms[0], [filteredBoms, selectedBomId]);

  const options = useMemo(() => {
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    return {
      projects: (payload.projects ?? []).map((group) => group.project),
      drawings: unique(boms.map((bom) => bom.drawingNo)),
      orderPeople: unique(boms.map((bom) => bom.orderPerson ?? "")),
      versions: unique(boms.map((bom) => bom.version))
    };
  }, [payload.projects, boms]);

  const grouped = useMemo(() => {
    const projectMap = new Map<string, { project: ProjectGroup["project"]; drawingGroups: Map<string, ArchiveBom[]> }>();
    for (const bom of filteredBoms) {
      const project = { id: bom.projectId, name: bom.projectName, code: bom.projectCode, status: bom.projectStatus };
      if (!projectMap.has(project.id)) projectMap.set(project.id, { project, drawingGroups: new Map() });
      const drawingKey = bom.drawingNo || "未关联图号";
      const group = projectMap.get(project.id)!;
      group.drawingGroups.set(drawingKey, [...(group.drawingGroups.get(drawingKey) ?? []), bom]);
    }
    return [...projectMap.values()];
  }, [filteredBoms]);

  function toggleProject(projectId: string) {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleDrawing(key: string) {
    setExpandedDrawings((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleBom(bomId: string) {
    setExpandedBoms((current) => {
      const next = new Set(current);
      if (next.has(bomId)) next.delete(bomId);
      else next.add(bomId);
      return next;
    });
  }

  function expandAll() {
    setExpandedProjects(new Set(filteredBoms.map((bom) => bom.projectId)));
    setExpandedDrawings(new Set(filteredBoms.map((bom) => `${bom.projectId}:${bom.drawingNo || "未关联图号"}`)));
    setExpandedBoms(new Set(filteredBoms.map((bom) => bom.id)));
  }

  function collapseAll() {
    setExpandedProjects(new Set());
    setExpandedDrawings(new Set());
    setExpandedBoms(new Set());
  }

  async function patchBom(bom: ArchiveBom, action: "void" | "restore" | "generatePurchase") {
    const label = action === "void" ? "作废 BOM" : action === "restore" ? "恢复 BOM" : "生成采购申请";
    if (!window.confirm(`确认${label}？`)) return;
    const reason = window.prompt(`${label}原因`);
    if (!reason?.trim()) {
      setError("请填写操作原因。");
      return;
    }
    setMessage("");
    setError("");
    const response = await fetch("/api/bom-archive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ projectId: bom.projectId, bomId: bom.id, action, reason, confirmed: true })
    });
    const body = await safeJson(response);
    if (!response.ok || body?.ok === false) {
      setError(responseError(body, `${label}失败。`));
      return;
    }
    setMessage(responseMessage(body, `${label}完成。`));
    await loadArchive();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand">BOM Archive</p>
            <h2 className="text-xl font-black text-ink">项目 BOM 档案收纳与追溯</h2>
            <p className="mt-1 text-sm text-ink/60">共 {boms.length} 份 BOM，当前筛选 {filteredBoms.length} 份。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={expandAll}>全部展开</button>
            <button type="button" className="btn-secondary" onClick={collapseAll}>全部收起</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="md:col-span-2">
            <span className="form-label">综合搜索</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" size={18} />
              <input className="input pl-10" value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} placeholder="项目号/名称/图号/文件名/材料/规格/填单人/上传人" />
            </div>
          </label>
          <label>
            <span className="form-label">项目</span>
            <select className="select" value={filters.projectId} onChange={(event) => setFilters({ ...filters, projectId: event.target.value })}>
              <option value="">全部项目</option>
              {options.projects.map((project) => <option key={project.id} value={project.id}>{project.code}｜{project.name}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">图号/部件位</span>
            <select className="select" value={filters.drawingNo} onChange={(event) => setFilters({ ...filters, drawingNo: event.target.value })}>
              <option value="">全部图号</option>
              {options.drawings.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">填单人</span>
            <select className="select" value={filters.orderPerson} onChange={(event) => setFilters({ ...filters, orderPerson: event.target.value })}>
              <option value="">全部填单人</option>
              {options.orderPeople.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">BOM 版本</span>
            <select className="select" value={filters.version} onChange={(event) => setFilters({ ...filters, version: event.target.value })}>
              <option value="">全部版本</option>
              {options.versions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">上传日期</span>
            <input className="input" type="date" value={filters.uploadedDate} onChange={(event) => setFilters({ ...filters, uploadedDate: event.target.value })} />
          </label>
          <label>
            <span className="form-label">填单日期</span>
            <input className="input" type="date" value={filters.orderDate} onChange={(event) => setFilters({ ...filters, orderDate: event.target.value })} />
          </label>
          <label>
            <span className="form-label">缺料状态</span>
            <select className="select" value={filters.hasShortage} onChange={(event) => setFilters({ ...filters, hasShortage: event.target.value })}>
              <option value="">全部</option>
              <option value="yes">有缺料</option>
              <option value="no">无缺料</option>
            </select>
          </label>
          <label>
            <span className="form-label">采购申请</span>
            <select className="select" value={filters.purchaseGenerated} onChange={(event) => setFilters({ ...filters, purchaseGenerated: event.target.value })}>
              <option value="">全部</option>
              <option value="yes">已生成</option>
              <option value="no">未生成</option>
            </select>
          </label>
        </div>
      </section>

      {message ? <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}

      {loading ? (
        <div className="rounded-lg border border-line bg-white p-8 text-center text-sm text-ink/60">正在加载 BOM 档案...</div>
      ) : filteredBoms.length === 0 ? (
        <div className="rounded-lg border border-line bg-white p-8 text-center text-sm text-ink/60">暂无匹配 BOM 档案</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
          <section className="space-y-3">
            {grouped.map((projectGroup) => {
              const projectOpen = expandedProjects.has(projectGroup.project.id);
              return (
                <div key={projectGroup.project.id} className="rounded-lg border border-line bg-white shadow-sm">
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => toggleProject(projectGroup.project.id)}>
                    <span className="flex min-w-0 items-center gap-2">
                      {projectOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <span className="truncate font-black text-ink">{projectGroup.project.code}｜{projectGroup.project.name}</span>
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand">{[...projectGroup.drawingGroups.values()].flat().length} 份 BOM</span>
                  </button>
                  {projectOpen ? (
                    <div className="space-y-3 border-t border-line p-3">
                      {[...projectGroup.drawingGroups.entries()].map(([drawingNo, drawingBoms]) => {
                        const drawingKey = `${projectGroup.project.id}:${drawingNo}`;
                        const drawingOpen = expandedDrawings.has(drawingKey);
                        const firstBom = drawingBoms[0];
                        return (
                          <div key={drawingKey} className="rounded-md border border-line bg-field/40">
                            <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left" onClick={() => toggleDrawing(drawingKey)}>
                              <span className="flex min-w-0 items-center gap-2">
                                {drawingOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                                <span className="truncate text-sm font-black text-ink">{drawingNo}</span>
                                {firstBom?.drawingVoided ? <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-bold text-zinc-700">图号已作废</span> : null}
                              </span>
                              <span className="text-xs font-semibold text-ink/55">{drawingBoms.length} 个版本</span>
                            </button>
                            {drawingOpen ? (
                              <div className="space-y-3 px-3 pb-3">
                                {drawingBoms.map((bom) => {
                                  const bomOpen = expandedBoms.has(bom.id);
                                  return (
                                    <div key={bom.id} className={`rounded-md border bg-white p-3 ${selectedBom?.id === bom.id ? "border-brand shadow-sm" : "border-line"}`}>
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <button type="button" className="min-w-0 text-left" onClick={() => { setSelectedBomId(bom.id); toggleBom(bom.id); }}>
                                          <span className="flex items-center gap-2">
                                            {bomOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                                            <FileSpreadsheet size={18} className="text-brand" />
                                            <span className="truncate text-base font-black text-ink">{bom.fileName || `${bom.drawingNo}-${bom.version}`}</span>
                                          </span>
                                          <span className="mt-1 block text-xs font-semibold text-ink/55">版本 {bom.version}｜上传 {formatDateTime(bom.uploadedAt)}</span>
                                        </button>
                                        <div className="flex flex-wrap gap-2">
                                          {bom.voided ? <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">已作废</span> : null}
                                          {bom.shortageCount > 0 ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">缺料 {bom.shortageCount}</span> : <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">无缺料</span>}
                                          {bom.purchaseGeneratedAt || bom.linkedPurchaseRequests.length ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand">已生成采购</span> : null}
                                        </div>
                                      </div>
                                      <div className="mt-3 grid gap-2 text-xs text-ink/65 md:grid-cols-2 xl:grid-cols-3">
                                        <span>项目号：{bom.projectCode || "-"}</span>
                                        <span>图号：{bom.drawingNo || "-"}</span>
                                        <span>填单人：{bom.orderPerson || "-"}</span>
                                        <span>填单日期：{formatDate(bom.orderDate)}</span>
                                        <span>上传人：{bom.uploadedByName || "-"}</span>
                                        <span>明细：{bom.detailCount} 条｜缺口：{bom.shortageQty}</span>
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={() => setSelectedBomId(bom.id)}><Eye size={16} />查看</button>
                                        <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={() => exportBomCsv(bom)}><Download size={16} />导出</button>
                                        <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={() => void patchBom(bom, "generatePurchase")} disabled={Boolean(bom.voided)}><Send size={16} />生成采购申请</button>
                                        <Link className="btn-secondary min-h-9 px-3 text-xs" href={`/projects/${bom.projectId}`}><PackageSearch size={16} />关联项目</Link>
                                        {bom.voided ? (
                                          <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={() => void patchBom(bom, "restore")}><ArchiveRestore size={16} />恢复</button>
                                        ) : (
                                          <button type="button" className="btn-secondary min-h-9 px-3 text-xs text-red-700" onClick={() => void patchBom(bom, "void")}><Trash2 size={16} />作废</button>
                                        )}
                                      </div>
                                      {bomOpen ? (
                                        <div className="mt-3 overflow-hidden rounded-md border border-line">
                                          <table className="min-w-full text-sm">
                                            <thead className="bg-field text-left text-xs text-ink/60">
                                              <tr>
                                                <th className="px-3 py-2">材料</th>
                                                <th className="px-3 py-2">规格</th>
                                                <th className="px-3 py-2">需求</th>
                                                <th className="px-3 py-2">库存</th>
                                                <th className="px-3 py-2">缺口</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {bom.analysis.slice(0, 8).map((row) => (
                                                <tr key={row.id} className="border-t border-line">
                                                  <td className="px-3 py-2 font-semibold text-ink">{row.materialName}</td>
                                                  <td className="px-3 py-2 text-ink/65">{row.spec || "-"}</td>
                                                  <td className="px-3 py-2">{row.quantity} {row.unit}</td>
                                                  <td className="px-3 py-2">{row.currentStock}</td>
                                                  <td className={`px-3 py-2 font-bold ${row.shortageQty > 0 ? "text-red-700" : "text-emerald-700"}`}>{row.shortageQty}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>

          <aside className="space-y-4">
            {selectedBom ? (
              <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand">BOM 详情</p>
                    <h3 className="mt-1 text-lg font-black text-ink">{selectedBom.fileName || selectedBom.drawingNo}</h3>
                    <p className="mt-1 text-sm text-ink/55">{selectedBom.projectCode}｜{selectedBom.projectName}</p>
                  </div>
                  {selectedBom.voided ? <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">已作废</span> : null}
                </div>
                <div className="mt-4 grid gap-2 text-sm text-ink/70 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <span>图号/部件位：{selectedBom.drawingNo || "-"}</span>
                  <span>BOM 版本：{selectedBom.version}</span>
                  <span>填单人：{selectedBom.orderPerson || "-"}</span>
                  <span>填单日期：{formatDate(selectedBom.orderDate)}</span>
                  <span>上传人：{selectedBom.uploadedByName || "-"}</span>
                  <span>上传时间：{formatDateTime(selectedBom.uploadedAt)}</span>
                  <span>明细数量：{selectedBom.detailCount}</span>
                  <span>缺料数量：{selectedBom.shortageCount}</span>
                </div>
                {selectedBom.voidReason ? <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">作废原因：{selectedBom.voidReason}</p> : null}

                <div className="mt-5">
                  <h4 className="font-black text-ink">缺料分析</h4>
                  <div className="mt-2 space-y-2">
                    {selectedBom.analysis.filter((row) => row.shortageQty > 0).slice(0, 8).map((row) => (
                      <div key={row.id} className="rounded-md border border-red-100 bg-red-50/55 px-3 py-2 text-sm">
                        <div className="font-bold text-red-800">{row.materialName}｜{row.spec || "-"}</div>
                        <div className="mt-1 text-red-700/80">需求 {row.quantity} {row.unit}，库存 {row.currentStock}，缺口 {row.shortageQty} {row.unit} {row.skippedReason ? `｜${row.skippedReason}` : ""}</div>
                      </div>
                    ))}
                    {selectedBom.analysis.filter((row) => row.shortageQty > 0).length === 0 ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">暂无缺料。</p> : null}
                  </div>
                </div>

                <div className="mt-5">
                  <h4 className="font-black text-ink">关联采购申请</h4>
                  <div className="mt-2 space-y-2">
                    {selectedBom.linkedPurchaseRequests.map((request) => (
                      <div key={request.id} className="rounded-md border border-line px-3 py-2 text-sm">
                        <div className="font-bold text-ink">{request.requestNo}</div>
                        <div className="text-ink/60">{request.status}｜{formatDateTime(request.createdAt)}</div>
                      </div>
                    ))}
                    {selectedBom.linkedPurchaseRequests.length === 0 ? <p className="rounded-md bg-field px-3 py-2 text-sm text-ink/60">暂无关联采购申请。</p> : null}
                  </div>
                </div>

                <div className="mt-5">
                  <h4 className="font-black text-ink">操作日志</h4>
                  <div className="mt-2 space-y-2">
                    {selectedBom.logs.slice(0, 8).map((log) => (
                      <div key={log.id} className="rounded-md border border-line px-3 py-2 text-sm">
                        <div className="font-bold text-ink">{log.action}｜{log.actor?.name || "-"}</div>
                        <div className="text-ink/60">{formatDateTime(log.createdAt)}｜{log.remark || "-"}</div>
                      </div>
                    ))}
                    {selectedBom.logs.length === 0 ? <p className="rounded-md bg-field px-3 py-2 text-sm text-ink/60">暂无 BOM 相关日志。</p> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
