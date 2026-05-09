"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Search, SlidersHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getAuthHeaders } from "@/lib/client-auth";
import { categoryOptions, zoneOptions } from "@/lib/warehouse-maps";

type InventoryItem = { id:string; name:string; categoryText:string; spec:string; material:string; dimensions:string; quantity:number; minStock:number; unit:string; zoneText:string; locationCode:string; project:string; lastInboundAt:string|null; lastOutboundAt:string|null; low:boolean };

export function InventoryClient() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [projects, setProjects] = useState<{id:string;name:string}[]>([]);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("全部分类");
  const [zone, setZone] = useState("全部库区");
  const [project, setProject] = useState("全部项目");
  const [lowOnly, setLowOnly] = useState(false);
  const [message] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return inventory.filter((item) => {
      const matchesCategory = category === "全部分类" || item.categoryText === category;
      const matchesZone = zone === "全部库区" || item.zoneText === zone;
      const matchesProject = project === "全部项目" || item.project === project;
      const matchesLow = !lowOnly || item.low;
      const haystack = [item.name, item.categoryText, item.spec, item.material, item.dimensions, item.zoneText, item.locationCode, item.project]
        .join(" ")
        .toLowerCase();
      return matchesCategory && matchesZone && matchesProject && matchesLow && (!q || haystack.includes(q));
    });
  }, [category, keyword, lowOnly, project, zone]);

  async function load() {
    const [i, p] = await Promise.all([
      fetch("/api/inventory", { headers: await getAuthHeaders(), cache: "no-store" }).then((r) => r.json()),
      fetch("/api/projects", { headers: await getAuthHeaders(), cache: "no-store" }).then((r) => r.json())
    ]);
    setInventory(i.inventory ?? []);
    setProjects(p.projects ?? []);
  }

  function exportInventory() {
    const header = ["材料", "分类", "规格", "材质", "尺寸", "库存", "单位", "库区", "库位", "项目"];
    const rows = filtered.map((item) => [item.name, item.categoryText, item.spec, item.material, item.dimensions, item.quantity, item.unit, item.zoneText, item.locationCode, item.project]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "库存报表.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <input className="field md:col-span-2" placeholder="名称、规格、材质、尺寸、库位" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>全部分类</option>
            {categoryOptions.map((item) => (
              <option key={item.value}>{item.label}</option>
            ))}
          </select>
          <select className="field" value={zone} onChange={(event) => setZone(event.target.value)}>
            <option>全部库区</option>
            {zoneOptions.map((item) => (
              <option key={item.value}>{item.label}</option>
            ))}
          </select>
          <select className="field" value={project} onChange={(event) => setProject(event.target.value)}>
            <option>全部项目</option>
            {projects.map((item) => (
              <option key={item.id}>{item.name}</option>
            ))}
            <option>通用库存</option>
            <option>工程退料</option>
          </select>
          <button className="btn-primary" type="button">
            <Search size={18} />
            {filtered.length} 条
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-md border border-line bg-field px-3 py-2 text-sm font-semibold text-ink/70">
            <input type="checkbox" className="h-5 w-5" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />
            只看库存不足
          </label>
          <a className="btn-secondary min-h-10 px-3" href="/stocktaking">
            <SlidersHorizontal size={16} />
            库存盘点
          </a>
          <button className="btn-secondary min-h-10 px-3">
            <AlertTriangle size={16} />
            低库存预警
          </button>
          <button className="btn-secondary min-h-10 px-3" onClick={exportInventory}>
            <Download size={16} />
            导出库存报表
          </button>
        </div>
      </section>
      {message ? <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div> : null}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-line bg-white px-4 py-10 text-center text-sm font-semibold text-ink/60">暂无匹配数据</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-field">
              <tr>
                {["材料", "分类", "规格尺寸", "当前库存", "单位", "库位", "来源工程", "最近入库", "最近出库", "状态"].map((column) => (
                  <th key={column} className="px-4 py-3 text-sm font-black text-ink">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm text-ink/78">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{item.categoryText}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{`${item.spec} / ${item.material} / ${item.dimensions}`}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-ink">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{item.unit}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{item.zoneText}-{item.locationCode}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{item.project}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{item.lastInboundAt?.slice(0, 16) ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">{item.lastOutboundAt?.slice(0, 16) ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-ink/78">
                    {item.low ? (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <AlertTriangle size={16} />
                        库存不足
                      </span>
                    ) : (
                      <StatusBadge status="正常" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
